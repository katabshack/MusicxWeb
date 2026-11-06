const express = require('express');
const cors = require('cors');
const yts = require('yt-search');
const { Ytdl, Quality } = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');

const app = express();

// Configuration CORS permissive pour autoriser ton site Render et les requêtes locales
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Range', 'Authorization']
}));

app.use(express.json());

const yt = new Ytdl();

const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Nettoyage des anciens fichiers téléchargés
const cleanOldDownloads = (currentVideoId) => {
  try {
    const files = fs.readdirSync(downloadsDir);
    for (const file of files) {
      if (!file.includes(currentVideoId)) {
        fs.unlinkSync(path.join(downloadsDir, file));
      }
    }
  } catch (err) {
    console.error("Erreur lors du nettoyage:", err);
  }
};

// Route de recherche via yt-search
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

// Route de streaming avec support des Range requests
app.get('/api/stream', async (req, res) => {
  const videoId = req.query.id;
  if (!videoId) return res.status(400).json({ error: 'ID de vidéo manquant' });

  const filePath = path.join(downloadsDir, `${videoId}.mp3`);
  const videoURL = `https://www.youtube.com/watch?v=${videoId}`;

  req.setTimeout(120000);

  try {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 1000) {
      cleanOldDownloads(videoId);
      console.log(`[API STREAM] Téléchargement pour la vidéo : ${videoId}`);
      
      const info = await yt.getInfo(videoURL);
      const audioStream = await yt.download(info, { 
        quality: Quality.HighestAudio, 
        filter: { hasAudio: true, hasVideo: false } 
      });

      const fileStream = fs.createWriteStream(filePath);
      audioStream.pipe(fileStream);

      await new Promise((resolve, reject) => {
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
        audioStream.on('error', reject);
      });
      console.log(`[API STREAM] Téléchargement terminé : ${videoId}.mp3`);
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/mpeg',
        'Access-Control-Allow-Origin': '*'
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(filePath).pipe(res);
    }

  } catch (err) {
    console.error("[API STREAM] Erreur:", err.message);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch(e) {}
    }
    if (!res.headersSent) {
      res.status(500).json({ error: 'Impossible de traiter ce morceau' });
    }
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Serveur MusicX démarré sur le port ${PORT} 🚀`);
});