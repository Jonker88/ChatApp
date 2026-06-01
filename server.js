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
    if (!user) return;
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
    if (data.to_user) {
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
