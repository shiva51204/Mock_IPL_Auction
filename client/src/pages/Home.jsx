import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE = 'http://localhost:4000';   // your backend port

export default function Home() {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState('');
  const [auctioneerName, setAuctioneerName] = useState('');
  const [roomIdToJoin, setRoomIdToJoin] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Create Room (Auctioneer)
  const handleCreateRoom = async () => {
    if (!roomName.trim() || !auctioneerName.trim()) {
      setError('Room name and your name are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await axios.post(`${API_BASE}/api/rooms`, {
        roomName: roomName.trim(),
        auctioneerName: auctioneerName.trim()
      });

      const { roomId } = res.data;
      navigate(`/room/${roomId}?name=${encodeURIComponent(auctioneerName)}&role=auctioneer`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  // Join Room (Participant)
  const handleJoinRoom = () => {
    if (!roomIdToJoin.trim() || !participantName.trim()) {
      setError('Room ID and your name are required');
      return;
    }

    const cleanRoomId = roomIdToJoin.trim().toUpperCase();
    navigate(`/room/${cleanRoomId}?name=${encodeURIComponent(participantName)}&role=participant`);
  };

  return (
    <div className="auction-bg min-h-screen text-white flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold mb-3 tracking-tight">IPL MOCK AUCTION</h1>
          <p className="text-xl text-gray-400">Play with friends • Real IPL players • Live bidding</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Create Room - Auctioneer */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700 rounded-3xl p-8">
            <h2 className="text-3xl font-semibold mb-6 flex items-center gap-3">
              👑 Create Room (Auctioneer)
            </h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Room Name</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g. Chennai Super Kings Auction"
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Your Name (Auctioneer)</label>
                <input
                  type="text"
                  value={auctioneerName}
                  onChange={(e) => setAuctioneerName(e.target.value)}
                  placeholder="e.g. Shiva"
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
                />
              </div>

              <button
                onClick={handleCreateRoom}
                disabled={loading}
                className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 text-black font-bold py-4 rounded-2xl text-lg transition-all mt-4"
              >
                {loading ? 'Creating Room...' : 'Create Room & Start Auction'}
              </button>
            </div>
          </div>

          {/* Join Room - Participant */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700 rounded-3xl p-8">
            <h2 className="text-3xl font-semibold mb-6 flex items-center gap-3">
              ⚔️ Join Auction
            </h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Room ID</label>
                <input
                  type="text"
                  value={roomIdToJoin}
                  onChange={(e) => setRoomIdToJoin(e.target.value)}
                  placeholder="e.g. ABC123"
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 uppercase"
                  maxLength={6}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Your Name</label>
                <input
                  type="text"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="e.g. Rohit"
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
                />
              </div>

              <button
                onClick={handleJoinRoom}
                className="w-full bg-white hover:bg-gray-100 text-black font-bold py-4 rounded-2xl text-lg transition-all mt-4"
              >
                Join Room
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 text-red-400 text-center bg-red-900/30 border border-red-700 rounded-xl p-4">
            {error}
          </div>
        )}

        <div className="text-center mt-10 text-gray-500 text-sm">
          Backend running on <span className="font-mono">http://localhost:4000</span>
        </div>
      </div>
    </div>
  );
}