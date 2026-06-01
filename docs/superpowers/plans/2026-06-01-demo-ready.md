# Demo-Ready Chat App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove login/signup auth, replace with an in-app name-entry modal (with demo accounts + guest fallback), strip MongoDB/bcrypt in favour of in-memory storage, and prepare the app for Railway deployment.

**Architecture:** `chat.html` becomes the single entry point — a modal overlay handles identity before the chat UI appears. `server.js` stores messages in plain JS arrays (no database). Railway auto-detects Node.js via the `start` script in `package.json`.

**Tech Stack:** Node.js, Express 5, Socket.IO 4, jQuery, Bootstrap 5, Railway

---

### Task 1: Rewrite server.js — drop MongoDB/bcrypt, add in-memory storage

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Replace the full contents of `server.js`**

```js
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
```

- [ ] **Step 2: Verify the server starts**

```bash
node server.js
```

Expected output: `Server running on port 3000`
Hit `Ctrl+C` to stop.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: replace mongodb/bcrypt with in-memory message store"
```

---

### Task 2: Update package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Replace the full contents of `package.json`**

```json
{
  "name": "chat-app-demo",
  "version": "1.0.0",
  "description": "Real-time chat app demo",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "dependencies": {
    "express": "^5.2.1",
    "socket.io": "^4.8.3"
  }
}
```

- [ ] **Step 2: Clean install without the removed packages**

```bash
npm install
```

Expected: `node_modules` updated, no errors. `bcryptjs` and `mongoose` will no longer be present.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove mongoose and bcryptjs dependencies"
```

---

### Task 3: Add modal CSS to style.css

**Files:**
- Modify: `view/style.css`

- [ ] **Step 1: Append the following CSS to the end of `view/style.css`**

```css
/* ===== Name Entry Modal ===== */
.name-modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.name-modal-card {
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 32px;
  width: 100%;
  max-width: 420px;
  text-align: center;
}

.name-modal-card h2 {
  margin-bottom: 4px;
}

.name-modal-card .subtitle {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-bottom: 20px;
}

.demo-accounts {
  margin-bottom: 12px;
}

.demo-label {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.demo-chips {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.demo-chip {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 20px;
  padding: 6px 16px;
  font-size: 0.88rem;
  cursor: pointer;
  transition: border-color 0.15s;
}

.demo-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.modal-divider {
  color: var(--text-muted);
  font-size: 0.85rem;
  margin: 12px 0;
}

.guest-link {
  display: block;
  margin-top: 14px;
  font-size: 0.85rem;
  color: var(--text-muted);
  text-decoration: none;
}

.guest-link:hover {
  color: var(--accent);
}
```

- [ ] **Step 2: Commit**

```bash
git add view/style.css
git commit -m "feat: add name entry modal styles"
```

---

### Task 4: Rewrite chat.html — add name modal, remove login redirect

**Files:**
- Modify: `view/chat.html`

- [ ] **Step 1: Replace the full contents of `view/chat.html`**

```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Messages - Chat App</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
</head>

<body>
    <!-- Name Entry Modal -->
    <div id="nameModal" class="name-modal-overlay" style="display:none;">
        <div class="name-modal-card">
            <div class="auth-logo">
                <img src="logo.png" alt="Chat App Logo" width="60" height="60" style="border-radius:50%;">
            </div>
            <h2>Welcome to Chat</h2>
            <p class="subtitle">Pick a demo account or enter your own name.</p>
            <div class="demo-accounts">
                <p class="demo-label">Demo accounts</p>
                <div class="demo-chips">
                    <button class="demo-chip" data-name="Alice">Alice</button>
                    <button class="demo-chip" data-name="Bob">Bob</button>
                    <button class="demo-chip" data-name="Charlie">Charlie</button>
                    <button class="demo-chip" data-name="Dana">Dana</button>
                </div>
            </div>
            <div class="modal-divider">or</div>
            <form id="nameForm">
                <input type="text" class="form-control" id="nameInput" placeholder="Enter your name" maxlength="20"
                    autocomplete="off">
                <button type="submit" class="btn-x mt-2">Enter Chat</button>
            </form>
            <a href="#" id="guestBtn" class="guest-link">Skip — use a guest name</a>
        </div>
    </div>

    <!-- Navbar -->
    <nav class="x-navbar">
        <div class="nav-brand">
            <img src="logo.png" alt="Logo" width="32" height="32" style="border-radius:50%;">
            <span>Messages</span>
        </div>
        <div class="nav-actions">
            <span class="user-badge" id="welcomeUser"></span>
            <button class="nav-btn" id="themeToggle" title="Toggle theme">🌙</button>
            <button class="btn-logout" id="logoutBtn">Log out</button>
        </div>
    </nav>

    <div class="container-fluid chat-container">
        <div class="row h-100 g-0">
            <!-- Sidebar -->
            <div class="col-md-3 sidebar">
                <div class="sidebar-heading">Rooms</div>
                <div id="roomList"></div>
                <button class="leave-btn d-none" id="leaveRoomBtn">Leave Room</button>

                <div class="users-heading">People</div>
                <div id="userList">
                    <p class="text-muted small px-3">Join a room to see people</p>
                </div>
            </div>

            <!-- Chat Area -->
            <div class="col-md-9 chat-main">
                <div class="chat-header">
                    <div>
                        <div class="chat-header-title" id="chatTitle">Select a room</div>
                        <div class="chat-header-sub" id="chatSubtitle">Pick a room from the sidebar to start messaging
                        </div>
                    </div>
                    <button class="back-btn d-none" id="backToRoom">← Back</button>
                </div>

                <div class="chat-messages" id="chatMessages">
                    <div class="welcome-state">
                        <img src="logo.png" alt="Logo" width="64" height="64"
                            style="border-radius:50%; margin-bottom:20px;">
                        <h4>Welcome to Chat</h4>
                        <p>Join a room from the sidebar to start chatting with others in real time.</p>
                    </div>
                </div>

                <div class="typing-indicator d-none" id="typingIndicator">
                    <span id="typingText"></span>
                    <span class="dots"><span></span><span></span><span></span></span>
                </div>

                <div class="chat-input d-none" id="chatInputArea">
                    <form id="messageForm">
                        <input type="text" class="form-control" id="messageInput" placeholder="Start a new message"
                            autocomplete="off">
                        <button type="submit" class="btn-send" title="Send">➤</button>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <script src="/socket.io/socket.io.js"></script>
    <script>
        // Theme
        function loadTheme() {
            const t = localStorage.getItem('chat_theme') || 'light';
            document.documentElement.setAttribute('data-theme', t);
            $('#themeToggle').text(t === 'dark' ? '☀️' : '🌙');
        }
        loadTheme();
        $('#themeToggle').on('click', function () {
            const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('chat_theme', next);
            $(this).text(next === 'dark' ? '☀️' : '🌙');
        });

        function generateGuestName() {
            return 'Guest#' + Math.floor(1000 + Math.random() * 9000);
        }

        function enterChat(name) {
            localStorage.setItem('chat_username', name);
            localStorage.setItem('chat_firstname', name);
            $('#nameModal').fadeOut(200, function () {
                initChat(name);
            });
        }

        $(document).ready(function () {
            const savedUsername = localStorage.getItem('chat_username');
            if (!savedUsername) {
                $('#nameModal').show();
            } else {
                initChat(savedUsername);
            }

            $('.demo-chip').on('click', function () {
                enterChat($(this).data('name'));
            });

            $('#nameForm').on('submit', function (e) {
                e.preventDefault();
                const name = $('#nameInput').val().trim() || generateGuestName();
                enterChat(name);
            });

            $('#guestBtn').on('click', function (e) {
                e.preventDefault();
                enterChat(generateGuestName());
            });
        });

        function initChat(username) {
            $('#welcomeUser').text('@' + username);

            const socket = io();
            let currentRoom = null;
            let privateChatUser = null;
            let typingTimeout = null;

            const roomIcons = {
                'devops': '⚙️',
                'cloud computing': '☁️',
                'covid19': '🦠',
                'sports': '⚽',
                'nodeJS': '🟢'
            };

            socket.emit('registerUser', username);

            fetch('/api/rooms')
                .then(res => res.json())
                .then(rooms => {
                    rooms.forEach(room => {
                        const icon = roomIcons[room] || '💬';
                        $('#roomList').append(
                            `<button class="room-btn" data-room="${room}"><span class="room-icon">${icon}</span> ${room}</button>`
                        );
                    });
                });

            $(document).on('click', '.room-btn', function () {
                const room = $(this).data('room');
                currentRoom = room;
                privateChatUser = null;
                socket.emit('joinRoom', room);

                $('.room-btn').removeClass('active');
                $(this).addClass('active');
                $('#chatTitle').text(room);
                $('#chatSubtitle').text('Group conversation');
                $('#chatMessages').html('');
                $('#chatInputArea').removeClass('d-none');
                $('#leaveRoomBtn').removeClass('d-none');
                $('#backToRoom').addClass('d-none');
                $('#messageInput').attr('placeholder', 'Start a new message');

                fetch('/api/messages/room/' + encodeURIComponent(room))
                    .then(res => res.json())
                    .then(messages => {
                        messages.forEach(msg => appendMessage(msg.from_user, msg.message, msg.date_sent));
                        scrollToBottom();
                    });
            });

            $('#leaveRoomBtn').on('click', function () {
                socket.emit('leaveRoom');
                currentRoom = null;
                privateChatUser = null;
                $('.room-btn').removeClass('active');
                $('#chatTitle').text('Select a room');
                $('#chatSubtitle').text('Pick a room from the sidebar to start messaging');
                $('#chatMessages').html(`
                    <div class="welcome-state">
                        <img src="logo.png" alt="Logo" width="64" height="64" style="border-radius:50%; margin-bottom:20px;">
                        <h4>Welcome to Chat</h4>
                        <p>Join a room from the sidebar to start chatting with others in real time.</p>
                    </div>`);
                $('#chatInputArea').addClass('d-none');
                $('#leaveRoomBtn').addClass('d-none');
                $('#userList').html('<p class="text-muted small px-3">Join a room to see people</p>');
            });

            $(document).on('click', '.user-item:not(.me)', function () {
                const targetUser = $(this).data('username');
                privateChatUser = targetUser;
                $('#chatTitle').text(targetUser);
                $('#chatSubtitle').text('Private conversation');
                $('#backToRoom').removeClass('d-none');
                $('#chatMessages').html('');
                $('#messageInput').attr('placeholder', 'Message @' + targetUser);

                fetch('/api/messages/private/' + encodeURIComponent(username) + '/' + encodeURIComponent(targetUser))
                    .then(res => res.json())
                    .then(messages => {
                        messages.forEach(msg => appendMessage(msg.from_user, msg.message, msg.date_sent));
                        scrollToBottom();
                    });
            });

            $('#backToRoom').on('click', function () {
                privateChatUser = null;
                $('#chatTitle').text(currentRoom);
                $('#chatSubtitle').text('Group conversation');
                $('#backToRoom').addClass('d-none');
                $('#chatMessages').html('');
                $('#messageInput').attr('placeholder', 'Start a new message');

                fetch('/api/messages/room/' + encodeURIComponent(currentRoom))
                    .then(res => res.json())
                    .then(messages => {
                        messages.forEach(msg => appendMessage(msg.from_user, msg.message, msg.date_sent));
                        scrollToBottom();
                    });
            });

            $('#messageForm').on('submit', function (e) {
                e.preventDefault();
                const message = $('#messageInput').val().trim();
                if (!message) return;
                if (privateChatUser) {
                    socket.emit('privateMessage', { to_user: privateChatUser, message });
                } else if (currentRoom) {
                    socket.emit('groupMessage', { message });
                }
                $('#messageInput').val('');
                socket.emit('stopTyping', privateChatUser ? { to_user: privateChatUser } : null);
            });

            $('#messageInput').on('input', function () {
                const data = privateChatUser ? { to_user: privateChatUser } : {};
                socket.emit('typing', data);
                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(() => { socket.emit('stopTyping', data); }, 2000);
            });

            socket.on('roomMessage', function (data) {
                if (!privateChatUser) {
                    appendMessage(data.from_user, data.message, data.date_sent);
                    scrollToBottom();
                }
            });

            socket.on('privateMessage', function (data) {
                if (privateChatUser === data.from_user || privateChatUser === data.to_user) {
                    if (data.from_user === username && privateChatUser === data.to_user) {
                        appendMessage(data.from_user, data.message, data.date_sent);
                    } else if (data.from_user !== username) {
                        appendMessage(data.from_user, data.message, data.date_sent);
                    }
                    scrollToBottom();
                } else if (data.from_user !== username) {
                    showNotification('@' + data.from_user + ' sent you a message');
                }
            });

            socket.on('updateUsers', function (users) {
                $('#userList').html('');
                users.forEach(u => {
                    const isMe = u === username;
                    const initial = u.charAt(0).toUpperCase();
                    $('#userList').append(`
                        <div class="user-item ${isMe ? 'me' : ''}" data-username="${u}">
                            <div class="user-avatar">${initial}</div>
                            <span>${isMe ? '@' + u + ' (you)' : '@' + u}</span>
                            <span class="online-dot"></span>
                        </div>
                    `);
                });
            });

            socket.on('typing', function (data) {
                $('#typingIndicator').removeClass('d-none');
                $('#typingText').text(data.from_user + ' is typing ');
            });

            socket.on('stopTyping', function () {
                $('#typingIndicator').addClass('d-none');
            });

            $('#logoutBtn').on('click', function () {
                localStorage.removeItem('chat_username');
                localStorage.removeItem('chat_firstname');
                window.location.reload();
            });

            function appendMessage(from, message, date) {
                const time = new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const isMe = from === username;
                const isSystem = from === 'System';
                let html;
                if (isSystem) {
                    html = `<div class="system-msg"><small>${message}</small></div>`;
                } else {
                    html = `
                        <div class="message ${isMe ? 'message-sent' : 'message-received'}">
                            <div class="message-header"><strong>${isMe ? 'You' : '@' + from}</strong> · <small>${time}</small></div>
                            <div class="message-body">${escapeHtml(message)}</div>
                        </div>`;
                }
                $('#chatMessages').append(html);
            }

            function scrollToBottom() {
                const el = document.getElementById('chatMessages');
                el.scrollTop = el.scrollHeight;
            }

            function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }

            function showNotification(msg) {
                const toast = $(`<div class="notification">${msg}</div>`);
                $('body').append(toast);
                setTimeout(() => toast.fadeOut(400, function () { $(this).remove(); }), 3000);
            }
        }
    </script>
</body>

</html>
```

- [ ] **Step 2: Verify in browser**

Start the server: `node server.js`

Open `http://localhost:3000/chat.html` in your browser. Expected:
- Modal overlay appears immediately
- Clicking "Alice" dismisses modal and enters chat as Alice
- "Skip" link enters chat as `Guest#XXXX`
- Typing a name and submitting enters chat with that name
- "Log out" button reloads the page and shows the modal again
- Rooms load, messages send/receive correctly

- [ ] **Step 3: Commit**

```bash
git add view/chat.html
git commit -m "feat: add name-entry modal, remove login redirect"
```

---

### Task 5: Delete unneeded files

**Files:**
- Delete: `view/login.html`
- Delete: `view/signup.html`
- Delete: `model/user.js`
- Delete: `model/groupMessage.js`
- Delete: `model/privateMessage.js`

- [ ] **Step 1: Delete the files**

```bash
rm view/login.html view/signup.html model/user.js model/groupMessage.js model/privateMessage.js
rmdir model
```

- [ ] **Step 2: Verify the server still starts cleanly**

```bash
node server.js
```

Expected: `Server running on port 3000` — no errors about missing modules.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove login/signup pages and unused model files"
```

---

### Task 6: Add .gitignore for Railway deployment

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
.env
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add .gitignore"
```

---

### Task 7: Deploy to Railway

- [ ] **Step 1: Push the repo to GitHub**

If you don't have a remote yet:
1. Go to [github.com/new](https://github.com/new) and create a new repository (e.g. `chat-app-demo`).
2. Run:
```bash
git remote add origin https://github.com/<your-username>/chat-app-demo.git
git branch -M main
git push -u origin main
```

- [ ] **Step 2: Create a Railway project**

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. Click **New Project → Deploy from GitHub repo**.
3. Select your `chat-app-demo` repository.
4. Railway auto-detects Node.js and runs `npm install` + `npm start`.

- [ ] **Step 3: Get your public URL**

In the Railway dashboard, go to your service → **Settings → Networking → Generate Domain**.
Railway assigns a public URL (e.g. `chat-app-demo.up.railway.app`).

- [ ] **Step 4: Verify the live deployment**

Open the Railway URL in your browser. Expected:
- Name modal appears
- Demo accounts work
- Real-time chat works between two browser tabs
