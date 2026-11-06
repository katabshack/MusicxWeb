const express = require('express');
const cors = require('cors');
const yts = require('yt-search');
const { Ytdl, Quality } = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const yt = new Ytdl();

const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}

// Nettoyer les anciens fichiers sauf celui en cours d'utilisation
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
    console.error("Erreur serveur:", err);
    res.status(500).json({ error: 'Erreur lors de la recherche' });
  }
});

// Route de streaming avec support des Range requests (pour la barre de progression)
app.get('/api/stream', async (req, res) => {
  const videoId = req.query.id;
  if (!videoId) return res.status(400).json({ error: 'ID de vidéo manquant' });

  const filePath = path.join(downloadsDir, `${videoId}.mp3`);
  const videoURL = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    // Si le fichier n'existe pas encore ou fait moins de 1 Ko, on le télécharge
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 1000) {
      cleanOldDownloads(videoId);
      console.log(`Téléchargement en cours pour la vidéo : ${videoId}`);
      
      const info = await yt.getInfo(videoURL);
      const audioStream = await yt.download(info, { 
        quality: Quality.HighestAudio, 
        filter: { hasAudio: true, hasVideo: false } 
      });

      const fileStream = fs.createWriteStream(filePath);
      audioStream.pipe(fileStream);

      // On attend que le fichier soit totalement écrit sur le disque
      await new Promise((resolve, reject) => {
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
        audioStream.on('error', reject);
      });
      console.log(`Téléchargement terminé : ${videoId}.mp3`);
    }

    // Gestion du streaming avec support des Range Requests (crucial pour le seek)
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/mpeg',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'bytes',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }

  } catch (err) {
    console.error("Erreur globale de streaming:", err);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch(e) {}
    }
    if (!res.headersSent) {
      res.status(500).json({ error: 'Impossible de traiter ce morceau' });
    }
  }
});

app.listen(3001, () => {
  console.log('Serveur MusicX démarré sur le port 3001 🚀');
});