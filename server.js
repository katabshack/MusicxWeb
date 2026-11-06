const express = require('express');
const cors = require('cors');
const yts = require('yt-search');
const axios = require('axios');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Range', 'Authorization']
}));

app.use(express.json());

// Route de recherche stable
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    console.log(`[API SEARCH] Recherche pour : "${query}"`);
    
    if (!query) return res.status(400).json({ error: 'Paramètre de recherche manquant' });

    const r = await yts(query);
    const videos = r.videos.slice(0, 15).map(v => ({
      id: v.videoId,
      title: v.title,
      artist: v.author.name,
      cover: v.thumbnail
    }));

    res.json(videos);
  } catch (err) {
    console.error("[API SEARCH] Erreur:", err.message);
    res.status(500).json({ error: 'Erreur lors de la recherche' });
  }
});

// Route de streaming directe via passerelle cloud (zéro crash, zéro worker)
app.get('/api/stream', async (req, res) => {
  const videoId = req.query.id;
  if (!videoId) return res.status(400).json({ error: 'ID de vidéo manquant' });

  try {
    console.log(`[API STREAM] Redirection du flux pour la vidéo : ${videoId}`);

    // Utilisation d'une passerelle audio publique stable pour obtenir le lien direct
    const response = await axios.get(`https://piped.video/api/v1/streams/${videoId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    // On récupère le flux audio le plus qualitatif
    const audioStreams = response.data.audioStreams;
    if (audioStreams && audioStreams.length > 0) {
      // Tri pour prendre le meilleur débit audio
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