const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(__dirname));

// Multer setup for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

app.post('/upload', upload.single('image'), (req, res) => {
    if (req.file) {
        res.json({ imageUrl: `/uploads/${req.file.filename}` });
    } else {
        res.status(400).json({ error: 'Image upload failed' });
    }
});

// Chat data
let messages = [];
let deletedMessages = [];

io.on('connection', (socket) => {
    socket.emit('messages', messages);
    socket.emit('deletedMessages', deletedMessages);

    socket.on('join', (user) => {
        socket.user = user;
    });

    socket.on('chatMessage', (msg) => {
        messages.push(msg);
        io.emit('chatMessage', msg);
    });

    socket.on('editMessage', (data) => {
        const message = messages.find(m => m.id === data.id);
        if (message) {
            message.editHistory.push({ text: message.text, timestamp: Date.now() });
            message.text = data.newText;
            message.timestamp = Date.now();
            io.emit('messageEdited', data);
        }
    });

    socket.on('deleteMessage', (messageId) => {
        const message = messages.find(m => m.id === messageId);
        if (message) {
            deletedMessages.push({ ...message });
            messages = messages.filter(m => m.id !== messageId);
            io.emit('messageDeleted', messageId);
            io.emit('deletedMessages', deletedMessages);
        }
    });

    socket.on('markRead', (user) => {
        messages.forEach(msg => {
            if (!msg.readBy) msg.readBy = [];
            if (!msg.readBy.includes(user)) {
                msg.readBy.push(user);
            }
        });
        io.emit('readStatus', { messages });
    });

    socket.on('leave', (user) => {
        socket.user = null;
    });

    socket.on('disconnect', () => {
        socket.user = null;
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
