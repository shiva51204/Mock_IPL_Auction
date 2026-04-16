const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// roomId -> { currentBid, currentLeader, timer, timerEnd }
const auctionState = {};

function getRoomState(roomId) {
  if (!auctionState[roomId]) auctionState[roomId] = { currentBid: 0, currentLeader: null, timer: null };
  return auctionState[roomId];
}

function broadcastRoomUpdate(io, roomId) {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  const teams = db.prepare('SELECT * FROM teams WHERE room_id = ?').all(roomId);
  const activePlayer = db.prepare(`
    SELECT ap.id as auction_player_id, ap.status, p.*
    FROM auction_players ap JOIN players p ON p.id = ap.player_id
    WHERE ap.room_id = ? AND ap.status = 'active' LIMIT 1
  `).get(roomId);
  const state = getRoomState(roomId);
  const stats = {
    soldCount: db.prepare("SELECT COUNT(*) as c FROM auction_players WHERE room_id = ? AND status='sold'").get(roomId).c,
    unsoldCount: db.prepare("SELECT COUNT(*) as c FROM auction_players WHERE room_id = ? AND status='unsold'").get(roomId).c,
    totalCount: db.prepare("SELECT COUNT(*) as c FROM auction_players WHERE room_id = ?").get(roomId).c,
  };
  io.to(roomId).emit('room_update', { room, teams, activePlayer, currentBid: state.currentBid, currentLeader: state.currentLeader, stats });
}

module.exports = function setupAuctionSocket(io) {
  io.on('connection', (socket) => {

    // ── JOIN ROOM ──────────────────────────────────────────
    socket.on('join_room', ({ roomId, name, role, teamName, budget, ipl_team }) => {
      roomId = roomId.toUpperCase();
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
      if (!room) return socket.emit('error', 'Room not found');

      socket.join(roomId);
      socket.data = { roomId, name, role }; // role: 'auctioneer' | 'participant'

      // If participant joining with a team
      if (role === 'participant') {
        const existing = db.prepare('SELECT * FROM teams WHERE room_id = ? AND owner_name = ?').get(roomId, name);
        if (!existing) {
          const teamId = uuidv4().slice(0, 8);
          db.prepare('INSERT INTO teams (id, room_id, name, owner_name, budget) VALUES (?, ?, ?, ?, ?)').run(teamId, roomId, teamName || name, name, budget || 100);
        }
      }

      broadcastRoomUpdate(io, roomId);
      socket.emit('joined', { roomId, name, role });

      // Send recent comments
      const comments = db.prepare('SELECT * FROM comments WHERE room_id = ? ORDER BY created_at ASC LIMIT 100').all(roomId);
      socket.emit('comment_history', comments);
    });

    // ── AUCTIONEER: ADD PLAYERS TO POOL ────────────────────
    socket.on('add_players_to_pool', ({ roomId, playerIds, randomize }) => {
      roomId = roomId.toUpperCase();
      // Clear existing pending players first
      db.prepare("DELETE FROM auction_players WHERE room_id = ? AND status = 'pending'").run(roomId);

      let ids = [...playerIds];
      if (randomize) ids = ids.sort(() => Math.random() - 0.5);

      const insert = db.prepare('INSERT OR IGNORE INTO auction_players (room_id, player_id, status) VALUES (?, ?, ?)');
      const insertMany = db.transaction((ids) => ids.forEach(pid => insert.run(roomId, pid, 'pending')));
      insertMany(ids);

      broadcastRoomUpdate(io, roomId);
      io.to(roomId).emit('pool_updated', { count: ids.length });
    });

    // ── AUCTIONEER: START AUCTION FOR NEXT/SPECIFIC PLAYER ─
    socket.on('start_player_auction', ({ roomId, auctionPlayerId }) => {
      roomId = roomId.toUpperCase();
      const state = getRoomState(roomId);

      // Mark any previously active as unsold if somehow still active
      db.prepare("UPDATE auction_players SET status='unsold' WHERE room_id=? AND status='active'").run(roomId);

      let target;
      if (auctionPlayerId) {
        target = db.prepare('SELECT ap.*, p.base_price FROM auction_players ap JOIN players p ON p.id=ap.player_id WHERE ap.id=? AND ap.room_id=?').get(auctionPlayerId, roomId);
      } else {
        target = db.prepare("SELECT ap.*, p.base_price FROM auction_players ap JOIN players p ON p.id=ap.player_id WHERE ap.room_id=? AND ap.status='pending' ORDER BY ap.id ASC LIMIT 1").get(roomId);
      }

      if (!target) return socket.emit('error', 'No pending players');

      db.prepare("UPDATE auction_players SET status='active' WHERE id=?").run(target.id);
      state.currentBid = target.base_price;
      state.currentLeader = null;

      broadcastRoomUpdate(io, roomId);
    });

    // ── PARTICIPANT: PLACE BID ──────────────────────────────
    socket.on('place_bid', ({ roomId, teamId, amount }) => {
      roomId = roomId.toUpperCase();
      const state = getRoomState(roomId);

      const activePlayer = db.prepare("SELECT * FROM auction_players WHERE room_id=? AND status='active'").get(roomId);
      if (!activePlayer) return socket.emit('error', 'No active auction');

      const team = db.prepare('SELECT * FROM teams WHERE id=? AND room_id=?').get(teamId, roomId);
      if (!team) return socket.emit('error', 'Team not found');

      // Validate amount
      if (amount <= state.currentBid) return socket.emit('bid_error', `Bid must be higher than ₹${state.currentBid} Cr`);
      if (amount > (team.budget - team.spent)) return socket.emit('bid_error', 'Insufficient budget');

      state.currentBid = amount;
      state.currentLeader = { teamId: team.id, teamName: team.name, ownerName: team.owner_name };

      db.prepare('INSERT INTO bids (room_id, auction_player_id, team_id, amount) VALUES (?,?,?,?)').run(roomId, activePlayer.id, teamId, amount);

      io.to(roomId).emit('bid_update', { currentBid: state.currentBid, currentLeader: state.currentLeader });
    });

    // ── PARTICIPANT: PASS / STOP BIDDING ───────────────────
    socket.on('pass_bid', ({ roomId, teamId }) => {
      roomId = roomId.toUpperCase();
      io.to(roomId).emit('team_passed', { teamId });
    });

    // ── AUCTIONEER: SELL PLAYER ────────────────────────────
    socket.on('sell_player', ({ roomId }) => {
      roomId = roomId.toUpperCase();
      const state = getRoomState(roomId);

      const activePlayer = db.prepare("SELECT * FROM auction_players WHERE room_id=? AND status='active'").get(roomId);
      if (!activePlayer) return socket.emit('error', 'No active auction');

      if (!state.currentLeader) {
        // No bids — mark unsold
        db.prepare("UPDATE auction_players SET status='unsold' WHERE id=?").run(activePlayer.id);
        io.to(roomId).emit('player_unsold', { auctionPlayerId: activePlayer.id });
      } else {
        // Sold!
        db.prepare("UPDATE auction_players SET status='sold', sold_to_team=?, sold_price=? WHERE id=?")
          .run(state.currentLeader.teamId, state.currentBid, activePlayer.id);
        db.prepare('UPDATE teams SET spent=spent+? WHERE id=?').run(state.currentBid, state.currentLeader.teamId);

        const player = db.prepare('SELECT * FROM players WHERE id=?').get(activePlayer.player_id);
        io.to(roomId).emit('player_sold', {
          player,
          soldTo: state.currentLeader,
          soldPrice: state.currentBid,
        });
      }

      state.currentBid = 0;
      state.currentLeader = null;
      broadcastRoomUpdate(io, roomId);
    });

    // ── AUCTIONEER: MARK UNSOLD MANUALLY ──────────────────
    socket.on('mark_unsold', ({ roomId }) => {
      roomId = roomId.toUpperCase();
      const state = getRoomState(roomId);
      db.prepare("UPDATE auction_players SET status='unsold' WHERE room_id=? AND status='active'").run(roomId);
      state.currentBid = 0;
      state.currentLeader = null;
      broadcastRoomUpdate(io, roomId);
    });

    // ── AUCTIONEER: SET TEAM BUDGETS ───────────────────────
    socket.on('set_team_budget', ({ roomId, teamId, budget }) => {
      roomId = roomId.toUpperCase();
      db.prepare('UPDATE teams SET budget=? WHERE id=? AND room_id=?').run(budget, teamId, roomId);
      broadcastRoomUpdate(io, roomId);
    });

    // ── AUCTIONEER: END ROOM ───────────────────────────────
    socket.on('end_room', ({ roomId }) => {
      roomId = roomId.toUpperCase();
      db.prepare("UPDATE rooms SET status='ended' WHERE id=?").run(roomId);
      broadcastRoomUpdate(io, roomId);
    });

    // ── COMMENT ────────────────────────────────────────────
    socket.on('send_comment', ({ roomId, senderName, message }) => {
      roomId = roomId.toUpperCase();
      if (!message?.trim()) return;
      db.prepare('INSERT INTO comments (room_id, sender_name, message) VALUES (?,?,?)').run(roomId, senderName, message.trim());
      const comment = db.prepare('SELECT * FROM comments WHERE room_id=? ORDER BY id DESC LIMIT 1').get(roomId);
      io.to(roomId).emit('new_comment', comment);
    });

    // ── DISCONNECT ─────────────────────────────────────────
    socket.on('disconnect', () => {
      const { roomId, name, role } = socket.data || {};
      if (roomId) io.to(roomId).emit('user_left', { name, role });
    });
  });
};
