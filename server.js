const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const users = new Map(); // socketId => username

io.on('connection', socket => {
  console.log('Yeni bağlanan:', socket.id);

  socket.on('join', username => {
    users.set(socket.id, username);
    console.log(`${username} katıldı.`);
    socket.broadcast.emit('user-joined', username);
  });

  socket.on('offer', offer => {
    socket.broadcast.emit('offer', offer);
  });

  socket.on('answer', answer => {
    socket.broadcast.emit('answer', answer);
  });

  socket.on('ice-candidate', candidate => {
    socket.broadcast.emit('ice-candidate', candidate);
  });

  socket.on('chat-message', msg => {
    const username = users.get(socket.id) || 'Anonim';
    const data = {
      username,
      message: msg,
      time: new Date().toLocaleTimeString()
    };
    io.emit('chat-message', data);
  });

  socket.on('disconnect', () => {
    const username = users.get(socket.id);
    if (username) {
      socket.broadcast.emit('user-left', username);
      users.delete(socket.id);
      console.log(`${username} ayrıldı.`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor`);
});
