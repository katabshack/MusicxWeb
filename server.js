const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Range', 'Authorization']
}));

app.use(express.json());

// Route de recherche via l'API Piped (contourne les blocages IP sur Render)
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    console.log(`[API SEARCH] Recherche pour : "${query}"`);
    
    if (!query) return res.status(400).json({ error: 'Paramètre de recherche manquant' });

    const response = await axios.get(`https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=videos`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });

    const items = response.data.items || [];
    const videos = items.slice(0, 15).map(v => {
      const videoId = v.url ? v.url.replace('/watch?v=', '') : '';
      return {
        id: videoId,
        title: v.title,
        artist: v.uploaderName,
        cover: v.thumbnail
      };
    }).filter(v => v.id);

    res.json(videos);
  } catch (err) {
    console.error("[API SEARCH] Erreur:", err.message);
    res.status(500).json({ error: 'Erreur lors de la recherche' });
  }
});

// Route de streaming via l'API Piped
app.get('/api/stream', async (req, res) => {
  const videoId = req.query.id;
  if (!videoId) return res.status(400).json({ error: 'ID de vidéo manquant' });

  try {
    console.log(`[API STREAM] Récupération du flux pour la vidéo : ${videoId}`);

    const response = await axios.get(`https://pipedapi.kavin.rocks/streams/${videoId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });

    const audioStreams = response.data.audioStreams;
    if (audioStreams && audioStreams.length > 0) {
      const bestAudio = audioStreams.reduce((prev, curr) => (curr.bitrate > prev.bitrate) ? curr : prev);
      return res.redirect(bestAudio.url);
    } else {
      res.status(404).json({ error: 'Aucun flux audio disponible' });
    }

  } catch (err) {
    console.error("[API STREAM] Erreur:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Impossible de lire ce morceau' });
    }
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Serveur MusicX démarré sur le port ${PORT} 🚀`);
});