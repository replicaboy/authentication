const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const http = require('http'); 
const { Server } = require('socket.io'); 

// Models & Routes
const Message = require('./models/Message'); 
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const server = http.createServer(app); 

// --- 1. Socket.io Setup ---
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "*", 
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 5e7 // 50 MB limit for images/files
});

// --- 2. Middleware ---
// CORS को FRONTEND_URL के साथ कॉन्फ़िगर किया ताकि Vercel से बात हो सके
app.use(cors({
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// --- 3. Health Check Route (UptimeRobot के लिए) ---
app.get('/', (req, res) => {
    res.send("Candy Chat Backend is Running Successfully! 🚀");
});

// --- 4. API Routes ---
// हमने App.jsx में /api/users/signup इस्तेमाल किया है, 
// इसलिए हम userRoutes को इसी पथ पर माउंट कर रहे हैं।
app.use('/api/users', userRoutes); 
app.use('/api/auth', authRoutes); // बैकअप के लिए

// --- 5. Message History API ---
app.get('/api/messages/:chatId', async (req, res) => {
    try {
        const messages = await Message.find({ chatId: req.params.chatId });
        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch messages" });
    }
});

// --- 6. Socket.io Logic ---
io.on('connection', (socket) => {
    console.log('🔥 A User Connected:', socket.id);

    socket.on('send_message', async (data) => {
        try {
            const newMessage = new Message(data);
            await newMessage.save();
            socket.broadcast.emit('receive_message', data);
        } catch (error) { console.log("Socket Send Error:", error); }
    });

    socket.on('delete_message', async (messageId) => {
        try {
            await Message.deleteOne({ id: messageId });
            io.emit('message_deleted', messageId); 
        } catch (error) { console.log("Socket Delete Error:", error); }
    });

    socket.on('typing', (roomId) => {
        socket.broadcast.emit('user_typing', roomId);
    });

    socket.on('stop_typing', (roomId) => {
        socket.broadcast.emit('user_stopped_typing', roomId);
    });

    socket.on('clear_chat', async (chatId) => {
        try {
            await Message.deleteMany({ chatId });
            io.emit('chat_cleared', chatId);
        } catch (error) { console.log("Socket Clear Error:", error); }
    });

    socket.on('disconnect', () => {
        console.log('❌ User Disconnected:', socket.id);
    });
});

// --- 7. Database & Server Start ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected Successfully'))
    .catch(err => console.log('❌ MongoDB Connection Error:', err));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));