 Real-Time Chat Application

A real-time chat application built with **Socket.io**, **Express**, **Mongoose**, and **Bootstrap**. Supports user authentication, room-based group messaging, private 1-on-1 messaging, typing indicators, and light/dark theme switching.

## Screenshots

### Sign Up Page
Create a new account with a unique username, first name, last name, and password.
<img width="1267" height="1229" alt="image" src="https://github.com/user-attachments/assets/a93927f4-ab8c-4ccb-804f-a2847b9d70d1" />


### Login Page
Authenticate with your credentials. Sessions are stored in localStorage.
<img width="1248" height="1234" alt="image" src="https://github.com/user-attachments/assets/ae551b0e-6740-44de-b134-6eb19f1a1527" />


### Chat Room
Join predefined rooms (devops, cloud computing, covid19, sports, nodeJS) and chat in real time. Messages are persisted in MongoDB.
<img width="941" height="532" alt="image" src="https://github.com/user-attachments/assets/43f7bec7-3373-4d3c-be41-80844ef3cd1f" />


### Two Users Chatting (Side by Side)
Multiple users can join the same room and exchange messages in real time.
<img width="1268" height="1263" alt="image" src="https://github.com/user-attachments/assets/fe908216-9afe-4435-be25-a76c4ef7033e" />


## Tech Stack

| Layer     | Technologies                              |
|-----------|-------------------------------------------|
| Backend   | Node.js, Express, Socket.io, Mongoose     |
| Frontend  | HTML5, CSS, Bootstrap 5, jQuery, Fetch API |
| Database  | MongoDB                                   |
| Auth      | bcryptjs for password hashing             |

## Features

- **User Signup & Login** – Register with a unique username, password hashed with bcrypt, session stored in localStorage
- **Room-Based Chat** – Join/leave predefined rooms, send and receive messages in real time via Socket.io
- **Private Messaging** – Click any online user to start a 1-on-1 private conversation
- **Typing Indicator** – "User is typing..." shown in both room and private chats
- **Message Persistence** – All group and private messages stored in MongoDB
- **Light/Dark Theme** – Toggle between light and dark mode, preference saved in localStorage
- **Logout** – Clears session and redirects to login page



**Student ID**: 101480537
Student Name: Jonathan Cao
