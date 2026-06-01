const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'view')));

const ROOMS = ['devops', 'cloud computing', 'covid19', 'sports', 'nodeJS'];
const onlineUsers = {};

const messageStore = { rooms: {}, private: [] };
const MAX_MESSAGES = 100;

function addRoomMessage(room, msg) {
  if (!messageStore.rooms[room]) messageStore.rooms[room] = [];
  messageStore.rooms[room].push(msg);
  if (messageStore.rooms[room].length > MAX_MESSAGES) messageStore.rooms[room].shift();
}

function addPrivateMessage(msg) {
  messageStore.private.push(msg);
  if (messageStore.private.length > MAX_MESSAGES * 10) messageStore.private.shift();
}

// Seed rooms with demo conversations so visitors see active history on first visit
function seedMessages() {
  const now = Date.now();
  const min = 60 * 1000;

  const seeds = {
    'devops': [
      { from_user: 'Alice', message: 'Hey team, just pushed the new CI pipeline — should cut build times by 40%.', date_sent: new Date(now - 85 * min) },
      { from_user: 'Bob', message: 'Nice! Was the bottleneck in the test runner?', date_sent: new Date(now - 82 * min) },
      { from_user: 'Alice', message: 'Yeah, parallelised the Jest suite. 12 min → 7 min.', date_sent: new Date(now - 80 * min) },
      { from_user: 'Charlie', message: "I've been meaning to containerise staging too. Anyone using Docker Compose for that?", date_sent: new Date(now - 60 * min) },
      { from_user: 'Dana', message: 'We use it for local dev, works great. I can share our compose file.', date_sent: new Date(now - 58 * min) },
      { from_user: 'Charlie', message: 'That would be awesome, thanks Dana!', date_sent: new Date(now - 55 * min) },
    ],
    'cloud computing': [
      { from_user: 'Bob', message: 'AWS just announced Graviton4 instances — 30% better price-performance apparently.', date_sent: new Date(now - 120 * min) },
      { from_user: 'Dana', message: "We're still on Graviton2, should probably look at migrating.", date_sent: new Date(now - 118 * min) },
      { from_user: 'Alice', message: 'The egress costs are still the painful part no matter the instance type 😅', date_sent: new Date(now - 115 * min) },
      { from_user: 'Bob', message: "Anyone using Azure? Our client is pushing for it.", date_sent: new Date(now - 90 * min) },
      { from_user: 'Charlie', message: 'We use Azure Functions for one project. Cold starts are rough on the free tier.', date_sent: new Date(now - 88 * min) },
    ],
    'sports': [
      { from_user: 'Charlie', message: 'Did everyone watch the match last night? What a finish!', date_sent: new Date(now - 200 * min) },
      { from_user: 'Alice', message: 'I was on the edge of my seat the whole second half 😅', date_sent: new Date(now - 198 * min) },
      { from_user: 'Bob', message: 'That last save from the goalkeeper was unreal.', date_sent: new Date(now - 195 * min) },
      { from_user: 'Dana', message: "Already looking forward to next week's game. Think they can keep the momentum?", date_sent: new Date(now - 180 * min) },
      { from_user: 'Charlie', message: 'Definitely, the whole team looks in great form right now.', date_sent: new Date(now - 175 * min) },
    ],
    'nodeJS': [
      { from_user: 'Dana', message: 'Anyone else excited about Node 22? Native fetch is a game changer.', date_sent: new Date(now - 45 * min) },
      { from_user: 'Alice', message: 'Yes! No more node-fetch as a dependency. Finally.', date_sent: new Date(now - 43 * min) },
      { from_user: 'Bob', message: 'The built-in watch mode is really useful for dev too.', date_sent: new Date(now - 40 * min) },
      { from_user: 'Dana', message: "Been using Bun for some side projects. The speed difference is noticeable.", date_sent: new Date(now - 20 * min) },
      { from_user: 'Charlie', message: 'Bun is great but I still hit compatibility issues with some packages.', date_sent: new Date(now - 18 * min) },
      { from_user: 'Alice', message: 'Same. Sticking with Node for production for now.', date_sent: new Date(now - 15 * min) },
    ],
    'covid19': [
      { from_user: 'Bob', message: 'New variant spreading in parts of Asia — anyone keeping an eye on it?', date_sent: new Date(now - 300 * min) },
      { from_user: 'Alice', message: "WHO said it's being monitored but not a major concern yet.", date_sent: new Date(now - 295 * min) },
      { from_user: 'Dana', message: 'Good to know. Hopefully the vaccines still hold up against it.', date_sent: new Date(now - 290 * min) },
      { from_user: 'Charlie', message: 'The updated boosters should cover it based on what I read.', date_sent: new Date(now - 285 * min) },
    ],
  };

  for (const [room, messages] of Object.entries(seeds)) {
    messages.forEach(msg => addRoomMessage(room, { ...msg, room }));
  }
}

seedMessages();

app.get('/', (req, res) => {
  res.redirect('/chat.html');
});

app.get('/api/rooms', (req, res) => {
  res.json(ROOMS);
});

app.get('/api/messages/room/:room', (req, res) => {
  res.json(messageStore.rooms[req.params.room] || []);
});

app.get('/api/messages/private/:user1/:user2', (req, res) => {
  const { user1, user2 } = req.params;
  res.json(messageStore.private.filter(m =>
    (m.from_user === user1 && m.to_user === user2) ||
    (m.from_user === user2 && m.to_user === user1)
  ));
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('registerUser', (username) => {
    onlineUsers[socket.id] = { username, room: null };
  });

  socket.on('joinRoom', (room) => {
    const user = onlineUsers[socket.id];
    if (!user || !ROOMS.includes(room)) return;
    if (user.room) {
      socket.leave(user.room);
      io.to(user.room).emit('roomMessage', { from_user: 'System', message: `${user.username} has left the room`, date_sent: new Date() });
      io.to(user.room).emit('updateUsers', getUsersInRoom(user.room));
    }
    user.room = room;
    socket.join(room);
    io.to(room).emit('roomMessage', { from_user: 'System', message: `${user.username} has joined the room`, date_sent: new Date() });
    io.to(room).emit('updateUsers', getUsersInRoom(room));
  });

  socket.on('leaveRoom', () => {
    const user = onlineUsers[socket.id];
    if (!user || !user.room) return;
    const room = user.room;
    socket.leave(room);
    user.room = null;
    io.to(room).emit('roomMessage', { from_user: 'System', message: `${user.username} has left the room`, date_sent: new Date() });
    io.to(room).emit('updateUsers', getUsersInRoom(room));
  });

  socket.on('groupMessage', (data) => {
    const user = onlineUsers[socket.id];
    if (!user || !user.room) return;
    const msg = { from_user: user.username, room: user.room, message: data.message, date_sent: new Date() };
    addRoomMessage(user.room, msg);
    io.to(user.room).emit('roomMessage', msg);
  });

  socket.on('privateMessage', (data) => {
    const user = onlineUsers[socket.id];
    if (!user) return;
    const msg = { from_user: user.username, to_user: data.to_user, message: data.message, date_sent: new Date() };
    addPrivateMessage(msg);
    const recipientSocketId = Object.keys(onlineUsers).find(id => onlineUsers[id].username === data.to_user);
    if (recipientSocketId) io.to(recipientSocketId).emit('privateMessage', msg);
    socket.emit('privateMessage', msg);
  });

  socket.on('typing', (data) => {
    const user = onlineUsers[socket.id];
    if (!user) return;
    if (data && data.to_user) {
      const rid = Object.keys(onlineUsers).find(id => onlineUsers[id].username === data.to_user);
      if (rid) io.to(rid).emit('typing', { from_user: user.username });
    } else if (user.room) {
      socket.to(user.room).emit('typing', { from_user: user.username });
    }
  });

  socket.on('stopTyping', (data) => {
    const user = onlineUsers[socket.id];
    if (!user) return;
    if (data && data.to_user) {
      const rid = Object.keys(onlineUsers).find(id => onlineUsers[id].username === data.to_user);
      if (rid) io.to(rid).emit('stopTyping', { from_user: user.username });
    } else if (user.room) {
      socket.to(user.room).emit('stopTyping', { from_user: user.username });
    }
  });

  socket.on('disconnect', () => {
    const user = onlineUsers[socket.id];
    if (user && user.room) {
      io.to(user.room).emit('roomMessage', { from_user: 'System', message: `${user.username} has disconnected`, date_sent: new Date() });
      io.to(user.room).emit('updateUsers', getUsersInRoom(user.room));
    }
    delete onlineUsers[socket.id];
    console.log('User disconnected:', socket.id);
  });
});

function getUsersInRoom(room) {
  return Object.values(onlineUsers).filter(u => u.room === room).map(u => u.username);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
