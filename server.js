const express = require('express');
const cors = require('cors');
const yts = require('yt-search');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Range', 'Authorization']
}));

app.use(express.json());

const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Route de recherche
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
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
    console.error("Erreur de recherche:", err);
    res.status(500).json({ error: 'Erreur lors de la recherche' });
  }
});

// Route de streaming via yt-dlp (gère le flux direct sans crash)
app.get('/api/stream', async (req, res) => {
  const videoId = req.query.id;
  if (!videoId) return res.status(400).json({ error: 'ID de vidéo manquant' });

  const videoURL = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    console.log(`[STREAM] Récupération du lien direct pour : ${videoId}`);

    // On demande à yt-dlp de nous extraire l'URL audio directe en streaming
    exec(`npx yt-dlp -g -f "bestaudio" "${videoURL}"`, (error, stdout, stderr) => {
      if (error || !stdout) {
        console.error("Erreur yt-dlp:", stderr);
        if (!res.headersSent) {
          return res.status(500).json({ error: 'Impossible de récupérer ce morceau' });
        }
        return;
      }

      const streamUrl = stdout.trim().split('\n')[0];
      if (streamUrl) {
        return res.redirect(streamUrl);
      } else {
        res.status(500).json({ error: 'Lien de flux introuvable' });
      }
    });

  } catch (err) {
    console.error("Erreur serveur:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erreur interne du serveur' });
    }
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Serveur MusicX démarré sur le port ${PORT} 🚀`);
});