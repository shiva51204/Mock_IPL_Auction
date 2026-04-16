const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const playersRouter = require('./routes/players');
const roomsRouter = require('./routes/rooms');
const setupAuctionSocket = require('./socket/auctionHandler');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

app.use('/api/players', playersRouter);
app.use('/api/rooms', roomsRouter);

app.get('/health', (_, res) => res.json({ ok: true }));

setupAuctionSocket(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));