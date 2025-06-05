const socket = io();

let username = null;
let localStream = null;
let peerConnection = null;

const servers = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

const usernamePrompt = document.getElementById('username-prompt');
const usernameInput = document.getElementById('username-input');
const usernameSubmit = document.getElementById('username-submit');

const callInterface = document.getElementById('call-interface');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message');
const sendMessageButton = document.getElementById('send-message');
const statusDiv = document.getElementById('status');

const toggleAudioBtn = document.getElementById('toggleAudio');
const toggleVideoBtn = document.getElementById('toggleVideo');

function logMessage(text, isSelf = false) {
  const div = document.createElement('div');
  div.textContent = text;
  if (isSelf) div.classList.add('self');
  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showVisualNotification(message) {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.position = 'fixed';
  notification.style.bottom = '20px';
  notification.style.right = '20px';
  notification.style.background = 'rgba(0,0,0,0.7)';
  notification.style.color = 'white';
  notification.style.padding = '10px 15px';
  notification.style.borderRadius = '8px';
  notification.style.boxShadow = '0 0 10px #000';
  notification.style.zIndex = 1000;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.transition = 'opacity 0.5s ease';
    notification.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 500);
  }, 3000);
}

async function startMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
  } catch (e) {
    alert('Kamera ve mikrofon erişimi reddedildi veya bulunamadı.');
    console.error(e);
  }
}

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(servers);

  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('ice-candidate', event.candidate);
    }
  };

  peerConnection.onconnectionstatechange = () => {
    if (peerConnection.connectionState === 'connected') {
      statusDiv.textContent = 'Bağlandı!';
    } else if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
      statusDiv.textContent = 'Bağlantı kesildi!';
    }
  };
}

async function startCall() {
  createPeerConnection();

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('offer', offer);
}

usernameSubmit.onclick = async () => {
  if (!usernameInput.value.trim()) {
    alert('Lütfen kullanıcı adı girin.');
    return;
  }
  username = usernameInput.value.trim();

  usernamePrompt.style.display = 'none';
  callInterface.style.display = 'flex';

  socket.emit('join', username);

  await startMedia();

  startCall();
};

socket.on('offer', async offer => {
  if (!peerConnection) {
    createPeerConnection();
  }
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', answer);
});

socket.on('answer', async answer => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', async candidate => {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {
    console.error('ICE adayı eklenirken hata:', e);
  }
});

sendMessageButton.onclick = () => {
  const msg = messageInput.value.trim();
  if (msg === '') return;
  socket.emit('chat-message', msg);
  logMessage(`Sen: ${msg}`, true);
  messageInput.value = '';
};

socket.on('chat-message', data => {
  if (data.username === username) return;

  const time = data.time || new Date().toLocaleTimeString();
  const messageText = `${data.username} [${time}]: ${data.message}`;
  logMessage(messageText);

  // Sesli ve görsel bildirim
  showVisualNotification(`Yeni mesaj: ${data.message}`);
});

socket.on('user-joined', user => {
  logMessage(`${user} sohbete katıldı.`);
  showVisualNotification(`${user} sohbete katıldı.`);
});

socket.on('user-left', user => {
  logMessage(`${user} sohbetten ayrıldı.`);
  showVisualNotification(`${user} sohbetten ayrıldı.`);
});

toggleAudioBtn.onclick = () => {
  if (!localStream) return;
  localStream.getAudioTracks().forEach(track => {
    track.enabled = !track.enabled;
  });
  toggleAudioBtn.textContent = localStream.getAudioTracks()[0].enabled ? 'Mikrofon Kapat' : 'Mikrofon Aç';
};

toggleVideoBtn.onclick = () => {
  if (!localStream) return;
  localStream.getVideoTracks().forEach(track => {
    track.enabled = !track.enabled;
  });
  toggleVideoBtn.textContent = localStream.getVideoTracks()[0].enabled ? 'Kamera Kapat' : 'Kamera Aç';
};
