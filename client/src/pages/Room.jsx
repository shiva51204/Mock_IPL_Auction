import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';

const API_BASE = 'http://localhost:4000';

export default function Room() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const name = searchParams.get('name');
  const role = searchParams.get('role');

  const [socket, setSocket] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [teams, setTeams] = useState([]);
  const [activePlayer, setActivePlayer] = useState(null);
  const [currentBid, setCurrentBid] = useState(0);
  const [currentLeader, setCurrentLeader] = useState(null);
  const [stats, setStats] = useState({ soldCount: 0, unsoldCount: 0, totalCount: 0 });

  const [bidAmount, setBidAmount] = useState('');
  const [myTeam, setMyTeam] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [playersPool, setPlayersPool] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [message, setMessage] = useState('');
  const [log, setLog] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [modalPlayer, setModalPlayer] = useState(null);

  const chatRef = useRef(null);

  // Socket Setup
  useEffect(() => {
    if (!name || !role) return navigate('/');

    const newSocket = io(API_BASE);
    setSocket(newSocket);

    newSocket.emit('join_room', {
      roomId: roomId.toUpperCase(),
      name,
      role,
      teamName: role === 'participant' ? `${name}'s Team` : undefined,
      budget: role === 'participant' ? 100 : undefined,
    });

    newSocket.on('room_update', (data) => {
      setRoomData(data.room);
      setTeams(data.teams || []);
      setActivePlayer(data.activePlayer);
      setCurrentBid(data.currentBid || data.activePlayer?.base_price || 0);
      setCurrentLeader(data.currentLeader);
      setStats(data.stats || { soldCount: 0, unsoldCount: 0, totalCount: 0 });

      if (role === 'participant') {
        const myTeamData = data.teams?.find(t => t.owner_name === name);
        setMyTeam(myTeamData);
      }
    });

    newSocket.on('bid_update', ({ currentBid, currentLeader }) => {
      setCurrentBid(currentBid);
      setCurrentLeader(currentLeader);
    });

    newSocket.on('player_sold', ({ player, soldTo, soldPrice }) => {
      setMessage(`${player.name} sold to ${soldTo.teamName} for ₹${soldPrice} Cr`);
      setTimeout(() => setMessage(''), 5000);
    });

    newSocket.on('player_unsold', () => {
      setMessage('Player went UNSOLD');
      setTimeout(() => setMessage(''), 4000);
    });

    newSocket.on('new_comment', (comment) => setComments(prev => [...prev, comment]));
    newSocket.on('comment_history', setComments);
    newSocket.on('error', (msg) => alert(msg));

    return () => newSocket.disconnect();
  }, [roomId, name, role, navigate]);

  // Fetch Auction Log
  useEffect(() => {
    const fetchLog = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/rooms/${roomId.toUpperCase()}/log`);
        setLog(res.data);
      } catch (e) {}
    };
    fetchLog();
  }, [roomId, stats.soldCount, stats.unsoldCount]);

  // Auto-scroll chat
  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
  }, [comments]);

  // Load players for auctioneer
  useEffect(() => {
    if (role === 'auctioneer') {
      axios.get(`${API_BASE}/api/players`)
        .then(res => setPlayersPool(res.data))
        .catch(console.error);
    }
  }, [role]);

  const openPlayerModal = (player) => {
    setModalPlayer(player);
    setShowPlayerModal(true);
  };

  const sendBid = () => {
    if (!socket || !myTeam || !bidAmount) return;
    const amount = parseFloat(bidAmount);
    if (amount <= currentBid) return alert('Bid must be higher!');

    socket.emit('place_bid', { 
      roomId: roomId.toUpperCase(), 
      teamId: myTeam.id, 
      amount 
    });
    setBidAmount('');
  };

  const quickBid = (inc) => setBidAmount((currentBid + inc).toFixed(1));

  const sendComment = () => {
    if (!socket || !newComment.trim()) return;
    socket.emit('send_comment', {
      roomId: roomId.toUpperCase(),
      senderName: name,
      message: newComment.trim()
    });
    setNewComment('');
  };

  // Auctioneer controls
  const startNextPlayer = () => socket?.emit('start_player_auction', { roomId: roomId.toUpperCase() });
  const sellCurrentPlayer = () => socket?.emit('sell_player', { roomId: roomId.toUpperCase() });
  const markUnsold = () => socket?.emit('mark_unsold', { roomId: roomId.toUpperCase() });

  const addToPool = (randomize = false) => {
    if (selectedPlayers.length === 0) return;
    socket?.emit('add_players_to_pool', {
      roomId: roomId.toUpperCase(),
      playerIds: selectedPlayers,
      randomize
    });
    setSelectedPlayers([]);
  };

  return (
    <div className="auction-bg min-h-screen text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-3xl px-8 py-5">
          <div>
            <h1 className="text-4xl font-bold">IPL Mock Auction</h1>
            <p className="text-yellow-400 font-mono">Room • {roomId.toUpperCase()}</p>
          </div>
          <div className="text-right">
            <div className="opacity-75 text-sm">Role</div>
            <div className={`text-2xl font-bold ${role === 'auctioneer' ? 'text-yellow-400' : 'text-emerald-400'}`}>
              {role === 'auctioneer' ? 'AUCTIONEER 👑' : 'BIDDER ⚔️'}
            </div>
          </div>
        </div>

        {message && <div className="text-center bg-emerald-600 py-4 rounded-2xl text-xl font-bold mb-6">{message}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Teams Sidebar */}
          <div className="lg:col-span-3">
            <div className="bg-slate-900/90 border border-slate-700 rounded-3xl p-6 sticky top-4">
              <h3 className="text-2xl font-semibold mb-6">Teams</h3>
              {teams.map((team) => (
                <div key={team.id} className="mb-5 bg-slate-800 rounded-2xl p-5">
                  <div className="font-bold text-lg">{team.name}</div>
                  <div className="text-gray-400 text-sm">Owner: {team.owner_name}</div>
                  <div className="mt-4 flex justify-between text-sm">
                    <span>Budget</span>
                    <span className="font-mono">₹{team.budget} Cr</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Spent</span>
                    <span className="font-mono text-orange-400">₹{team.spent || 0} Cr</span>
                  </div>
                  <div className="mt-3 h-2 bg-slate-700 rounded-full">
                    <div 
                      className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"
                      style={{ width: `${Math.min(((team.spent || 0) / team.budget) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Area */}
          <div className="lg:col-span-6 space-y-6">
            {/* Current Player */}
            <div className="bg-slate-900/95 border border-slate-600 rounded-3xl p-10 text-center">
              {activePlayer ? (
                <>
                  <div 
                    onClick={() => openPlayerModal(activePlayer)}
                    className="cursor-pointer hover:text-yellow-400 transition"
                  >
                    <div className="text-6xl font-bold mb-2">{activePlayer.name}</div>
                    <div className="text-xl text-gray-400 mb-8">
                      {activePlayer.role} • Base: ₹{activePlayer.base_price} Cr
                    </div>
                  </div>

                  <div className="text-[4.8rem] font-mono font-bold text-yellow-400 mb-10">
                    ₹{currentBid} Cr
                  </div>

                  {currentLeader && (
                    <div className="text-xl mb-8">
                      Leading Bid: <span className="font-bold text-emerald-400">{currentLeader.teamName}</span>
                    </div>
                  )}

                  {/* Participant Bidding */}
                  {role === 'participant' && myTeam && (
                    <div className="space-y-6">
                      <div className="flex flex-wrap gap-3 justify-center">
                        {[0.5, 1, 2, 5].map(inc => (
                          <button
                            key={inc}
                            onClick={() => quickBid(inc)}
                            className="bg-slate-800 hover:bg-slate-700 px-7 py-3 rounded-2xl font-medium"
                          >
                            +₹{inc} Cr
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-4 max-w-sm mx-auto">
                        <input
                          type="number"
                          step="0.1"
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                          placeholder="Enter bid"
                          className="flex-1 bg-slate-800 border border-slate-600 rounded-2xl px-6 py-4 text-center text-2xl focus:border-yellow-400"
                        />
                        <button
                          onClick={sendBid}
                          disabled={!bidAmount || parseFloat(bidAmount) <= currentBid}
                          className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 px-10 rounded-2xl font-bold text-black text-xl"
                        >
                          BID
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Auctioneer Controls */}
                  {role === 'auctioneer' && (
                    <div className="flex gap-4 justify-center mt-10">
                      <button onClick={sellCurrentPlayer} className="bg-emerald-600 hover:bg-emerald-700 px-14 py-5 rounded-2xl font-bold text-xl">SELL PLAYER</button>
                      <button onClick={markUnsold} className="bg-red-600 hover:bg-red-700 px-14 py-5 rounded-2xl font-bold text-xl">MARK UNSOLD</button>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-20">
                  <p className="text-4xl text-gray-400 mb-8">No player currently up for auction</p>
                  {role === 'auctioneer' && (
                    <button 
                      onClick={startNextPlayer}
                      className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-16 py-6 rounded-3xl text-2xl"
                    >
                      Start Next Player Auction
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Player Pool for Auctioneer */}
            {role === 'auctioneer' && playersPool.length > 0 && (
              <div className="bg-slate-900/90 border border-slate-700 rounded-3xl p-8">
                <h3 className="text-2xl font-semibold mb-6">Player Pool ({playersPool.length})</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                  {playersPool.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPlayers(prev => 
                        prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                      )}
                      className={`p-4 rounded-2xl text-left transition-all border ${
                        selectedPlayers.includes(p.id) 
                          ? 'bg-yellow-500 text-black border-yellow-500' 
                          : 'bg-slate-800 hover:bg-slate-700'
                      }`}
                    >
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-gray-400">₹{p.base_price} Cr • {p.role}</div>
                    </button>
                  ))}
                </div>

                <div className="flex gap-4 mt-8">
                  <button onClick={() => addToPool(false)} disabled={selectedPlayers.length === 0}
                    className="flex-1 py-5 bg-white text-black rounded-2xl font-bold disabled:opacity-50">
                    Add Selected ({selectedPlayers.length})
                  </button>
                  <button onClick={() => addToPool(true)} disabled={selectedPlayers.length === 0}
                    className="flex-1 py-5 bg-yellow-500 text-black rounded-2xl font-bold disabled:opacity-50">
                    Add + Randomize
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Chat + Log */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-slate-900/90 border border-slate-700 rounded-3xl flex flex-col h-[460px]">
              <div className="p-6 border-b border-slate-700 font-semibold">Live Chat</div>
              <div ref={chatRef} className="flex-1 p-6 overflow-y-auto space-y-4 text-sm">
                {comments.map((c, i) => (
                  <div key={i} className="bg-slate-800 rounded-2xl p-4">
                    <span className="text-yellow-400 font-medium">{c.sender_name}</span>
                    <span className="mx-2 text-gray-500">→</span>
                    {c.message}
                  </div>
                ))}
                {comments.length === 0 && <div className="text-center text-gray-500 py-12">No messages yet</div>}
              </div>
              <div className="p-4 border-t border-slate-700 flex gap-2">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendComment()}
                  placeholder="Type a message..."
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-2xl px-5 py-3 focus:outline-none"
                />
                <button onClick={sendComment} className="bg-yellow-500 hover:bg-yellow-600 px-8 rounded-2xl font-bold text-black">Send</button>
              </div>
            </div>

            <button
              onClick={() => setShowLog(!showLog)}
              className="w-full py-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-3xl font-semibold"
            >
              {showLog ? 'Hide' : 'View'} Auction Log ({log.length})
            </button>

            {showLog && log.length > 0 && (
              <div className="bg-slate-900/90 border border-slate-700 rounded-3xl p-6 max-h-96 overflow-y-auto text-sm">
                <h4 className="font-semibold mb-4">Auction History</h4>
                {log.map((entry, i) => (
                  <div key={i} className="mb-5 pb-4 border-b border-slate-700 last:border-none">
                    <div className="font-medium">{entry.name}</div>
                    <div className="text-xs text-gray-400">{entry.role}</div>
                    {entry.status === 'sold' ? (
                      <div className="text-emerald-400 font-mono">Sold @ ₹{entry.sold_price} Cr to {entry.sold_to_team}</div>
                    ) : (
                      <div className="text-red-400">Unsold</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Player Stats Modal */}
      {showPlayerModal && modalPlayer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-600 rounded-3xl max-w-lg w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold">{modalPlayer.name}</h2>
              <button onClick={() => setShowPlayerModal(false)} className="text-3xl text-gray-400 hover:text-white">×</button>
            </div>

            <div className="grid grid-cols-2 gap-6 text-sm">
              <div><span className="text-gray-400">Role:</span> <span className="font-medium">{modalPlayer.role}</span></div>
              <div><span className="text-gray-400">Base Price:</span> <span className="font-medium">₹{modalPlayer.base_price} Cr</span></div>
              <div><span className="text-gray-400">Nationality:</span> <span className="font-medium">{modalPlayer.nationality}</span></div>
              <div><span className="text-gray-400">Set:</span> <span className="font-medium">{modalPlayer.set_name}</span></div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-6">
              {modalPlayer.runs > 0 && (
                <div className="bg-slate-800 p-5 rounded-2xl">
                  <div className="text-4xl font-bold text-orange-400">{modalPlayer.runs}</div>
                  <div className="text-xs text-gray-400">RUNS</div>
                </div>
              )}
              {modalPlayer.wickets > 0 && (
                <div className="bg-slate-800 p-5 rounded-2xl">
                  <div className="text-4xl font-bold text-blue-400">{modalPlayer.wickets}</div>
                  <div className="text-xs text-gray-400">WICKETS</div>
                </div>
              )}
              {modalPlayer.average > 0 && (
                <div className="bg-slate-800 p-5 rounded-2xl">
                  <div className="text-4xl font-bold">{modalPlayer.average}</div>
                  <div className="text-xs text-gray-400">AVERAGE</div>
                </div>
              )}
              {modalPlayer.strike_rate > 0 && (
                <div className="bg-slate-800 p-5 rounded-2xl">
                  <div className="text-4xl font-bold">{modalPlayer.strike_rate}</div>
                  <div className="text-xs text-gray-400">STRIKE RATE</div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowPlayerModal(false)}
              className="mt-10 w-full py-4 bg-slate-700 hover:bg-slate-600 rounded-2xl font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}