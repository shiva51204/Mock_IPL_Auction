CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  base_price REAL NOT NULL,
  set_name TEXT,
  role TEXT,
  franchise TEXT,
  nationality TEXT,
  runs INTEGER DEFAULT 0,
  average REAL DEFAULT 0,
  strike_rate REAL DEFAULT 0,
  wickets INTEGER DEFAULT 0,
  economy REAL DEFAULT 0,
  bowling_sr REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  auctioneer_name TEXT NOT NULL,
  status TEXT DEFAULT 'waiting',   -- waiting | active | ended
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  budget REAL NOT NULL,
  spent REAL DEFAULT 0,
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE TABLE IF NOT EXISTS auction_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',   -- pending | active | sold | unsold
  sold_to_team TEXT,
  sold_price REAL,
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS bids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  auction_player_id INTEGER NOT NULL,
  team_id TEXT NOT NULL,
  amount REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);
