const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// POST /rooms — create a new room (auctioneer)
router.post('/', (req, res) => {
  const { roomName, auctioneerName } = req.body;
  if (!roomName || !auctioneerName) return res.status(400).json({ error: 'roomName and auctioneerName required' });

  const id = uuidv4().slice(0, 6).toUpperCase(); // short room code
  db.prepare('INSERT INTO rooms (id, name, auctioneer_name) VALUES (?, ?, ?)').run(id, roomName, auctioneerName);
  res.json({ roomId: id, roomName, auctioneerName });
});

// GET /rooms/:id — get room details + teams + auction state
router.get('/:id', (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const teams = db.prepare('SELECT * FROM teams WHERE room_id = ?').all(room.id);

  const activePlayer = db.prepare(`
    SELECT ap.*, p.* FROM auction_players ap
    JOIN players p ON p.id = ap.player_id
    WHERE ap.room_id = ? AND ap.status = 'active'
    LIMIT 1
  `).get(room.id);

  const soldCount = db.prepare("SELECT COUNT(*) as c FROM auction_players WHERE room_id = ? AND status='sold'").get(room.id).c;
  const unsoldCount = db.prepare("SELECT COUNT(*) as c FROM auction_players WHERE room_id = ? AND status='unsold'").get(room.id).c;
  const totalCount = db.prepare("SELECT COUNT(*) as c FROM auction_players WHERE room_id = ?").get(room.id).c;

  res.json({ room, teams, activePlayer, stats: { soldCount, unsoldCount, totalCount } });
});

// GET /rooms/:id/log — sold + unsold players log
router.get('/:id/log', (req, res) => {
  const roomId = req.params.id.toUpperCase();
  const log = db.prepare(`
    SELECT ap.status, ap.sold_price, ap.sold_to_team,
           p.name, p.role, p.nationality, p.set_name, p.runs, p.average, p.strike_rate,
           p.wickets, p.economy, p.bowling_sr, p.base_price
    FROM auction_players ap
    JOIN players p ON p.id = ap.player_id
    WHERE ap.room_id = ? AND ap.status IN ('sold','unsold')
    ORDER BY ap.id DESC
  `).all(roomId);
  res.json(log);
});

// GET /rooms/:id/comments — last 100 comments
router.get('/:id/comments', (req, res) => {
  const comments = db.prepare('SELECT * FROM comments WHERE room_id = ? ORDER BY created_at ASC LIMIT 100').all(req.params.id.toUpperCase());
  res.json(comments);
});

// GET /rooms/:id/analytics — spend analytics per team
router.get('/:id/analytics', (req, res) => {
  const roomId = req.params.id.toUpperCase();
  const teams = db.prepare('SELECT * FROM teams WHERE room_id = ?').all(roomId);

  const analytics = teams.map(team => {
    const players = db.prepare(`
      SELECT p.name, p.role, p.nationality, ap.sold_price
      FROM auction_players ap
      JOIN players p ON p.id = ap.player_id
      WHERE ap.room_id = ? AND ap.sold_to_team = ? AND ap.status = 'sold'
    `).all(roomId, team.id);

    const byRole = players.reduce((acc, p) => {
      acc[p.role] = (acc[p.role] || 0) + p.sold_price;
      return acc;
    }, {});

    return { team, players, byRole };
  });

  res.json(analytics);
});

module.exports = router;
