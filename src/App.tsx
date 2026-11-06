import React, { useState, useRef, useEffect } from 'react';
import { Search, Play, Pause, Music, Sparkles, Loader2, SkipBack, SkipForward, Home, Library, Heart, Volume2, VolumeX } from 'lucide-react';
import axios from 'axios';

interface Track {
  id: string;
  title: string;
  artist: string;
  cover: string;
}

const SERVER_URL = import.meta.env.PROD 
  ? 'https://foothold-magnitude-wife.ngrok-free.dev' 
  : 'http://localhost:3001';

const api = axios.create({
  baseURL: SERVER_URL,
  headers: {
    'ngrok-skip-browser-warning': 'true'
  }
});

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'library'>('home');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);

  const [favorites, setFavorites] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem('musicx_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [loading, setLoading] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('musicx_favorites', JSON.stringify(favorites));
    } catch (e) {}
  }, [favorites]);

  const currentPlaylist = activeTab === 'home' ? searchResults : favorites;
  const currentTrack = currentTrackIndex !== null && currentPlaylist[currentTrackIndex] 
    ? currentPlaylist[currentTrackIndex] 
    : null;

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.get(`/api/search?q=${encodeURIComponent(query)}`);
        setSearchResults(response.data);
      } catch (err) {
        console.error("Erreur de recherche:", err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query]);

  const handlePlayTrack = (index: number) => {
    setCurrentTrackIndex(index);
    setIsPlaying(true);
    setIsLoadingTrack(true);
  };

  useEffect(() => {
    if (currentTrack && audioRef.current) {
      const streamUrl = `${SERVER_URL}/api/stream?id=${currentTrack.id}`;
      
      fetch(streamUrl, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      })
      .then(res => res.blob())
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob);
        if (audioRef.current) {
          audioRef.current.src = objectUrl;
          audioRef.current.load();
          audioRef.current.play()
            .then(() => {
              setIsPlaying(true);
              setIsLoadingTrack(false);
            })
            .catch(e => {
              console.error("Erreur de lecture audio:", e);
              setIsLoadingTrack(false);
            });
        }
      })
      .catch(err => {
        console.error("Erreur lors du fetch du flux audio:", err);
        setIsLoadingTrack(false);
      });
    }
  }, [currentTrackIndex, activeTab]);

  const togglePlayPause = () => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(e => console.error(e));
    }
  };

  const handleNext = () => {
    if (currentPlaylist.length === 0) return;
    if (currentTrackIndex !== null) {
      const nextIndex = (currentTrackIndex + 1) % currentPlaylist.length;
      setCurrentTrackIndex(nextIndex);
    }
  };

  const handlePrev = () => {
    if (currentPlaylist.length === 0) return;
    if (currentTrackIndex !== null) {
      const prevIndex = (currentTrackIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
      setCurrentTrackIndex(prevIndex);
    }
  };

  const toggleFavorite = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const exists = prev.some(t => t.id === track.id);
      if (exists) {
        return prev.filter(t => t.id !== track.id);
      } else {
        return [...prev, track];
      }
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="mx-app">
      <audio
        ref={audioRef}
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
        onEnded={() => handleNext()}
      />

      <header className="mx-header">
        <div className="mx-brand-row">
          <div className="mx-brand">
            <div className="mx-logo-icon">
              <Music size={18} color="#ffffff" />
            </div>
            <span className="mx-title">MusicX</span>
          </div>

          <div className="mx-tabs" style={{ width: 'auto' }}>
            <button
              onClick={() => setActiveTab('home')}
              className={`mx-tab-btn ${activeTab === 'home' ? 'active' : ''}`}
            >
              <Home size={15} />
              <span>Accueil</span>
            </button>
            <button
              onClick={() => setActiveTab('library')}
              className={`mx-tab-btn ${activeTab === 'library' ? 'active' : ''}`}
            >
              <Library size={15} />
              <span>Biblio ({favorites.length})</span>
            </button>
          </div>
        </div>

        <div className="mx-search-box">
          <Search className="mx-search-icon" />
          <input
            type="text"
            placeholder="Rechercher un artiste, un titre..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mx-search-input"
          />
          {loading && <Loader2 className="mx-loader-search" />}
        </div>
      </header>

      <main className="mx-main">
        {activeTab === 'home' ? (
          <div>
            <h2 className="mx-section-title">
              {query ? 'Résultats de recherche' : 'Découverte'}
            </h2>

            {searchResults.length === 0 ? (
              <div className="mx-empty-state">
                <div className="mx-empty-icon">
                  <Sparkles size={28} />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '6px' }}>Bienvenue sur MusicX</h3>
                <p style={{ color: '#71717a', fontSize: '0.85rem', maxWidth: '300px' }}>
                  Recherche un artiste pour lancer la liste de lecture en continu.
                </p>
              </div>
            ) : (
              <div className="mx-grid">
                {searchResults.map((track, index) => {
                  const isFav = favorites.some(t => t.id === track.id);
                  const isCurrent = currentTrack?.id === track.id;

                  return (
                    <div
                      key={track.id}
                      onClick={() => handlePlayTrack(index)}
                      className={`mx-card ${isCurrent ? 'active' : ''}`}
                    >
                      <div className="mx-card-img-wrapper">
                        <img src={track.cover} alt={track.title} className="mx-card-img" />
                        <button
                          onClick={(e) => toggleFavorite(track, e)}
                          className={`mx-fav-btn ${isFav ? 'active' : ''}`}
                          title="Favoris"
                        >
                          <Heart size={16} fill={isFav ? '#ffffff' : 'none'} />
                        </button>
                        <div className="mx-play-overlay">
                          <div className="mx-play-btn-circle">
                            {isCurrent && isPlaying ? <Pause size={16} fill="#ffffff" /> : <Play size={16} fill="#ffffff" style={{ marginLeft: '2px' }} />}
                          </div>
                        </div>
                      </div>
                      <h4 className="mx-card-title">{track.title}</h4>
                      <p className="mx-card-artist">{track.artist}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            <h2 className="mx-section-title">Ma Bibliothèque ({favorites.length})</h2>
            {favorites.length === 0 ? (
              <div className="mx-empty-state">
                <div className="mx-empty-icon">
                  <Heart size={28} />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '6px' }}>Aucun favori pour l'instant</h3>
                <p style={{ color: '#71717a', fontSize: '0.85rem', maxWidth: '300px' }}>
                  Ajoute des musiques à tes favoris en cliquant sur le cœur lors de tes recherches.
                </p>
              </div>
            ) : (
              <div className="mx-grid">
                {favorites.map((track, index) => {
                  const isCurrent = currentTrack?.id === track.id;

                  return (
                    <div
                      key={track.id}
                      onClick={() => handlePlayTrack(index)}
                      className={`mx-card ${isCurrent ? 'active' : ''}`}
                    >
                      <div className="mx-card-img-wrapper">
                        <img src={track.cover} alt={track.title} className="mx-card-img" />
                        <button
                          onClick={(e) => toggleFavorite(track, e)}
                          className="mx-fav-btn active"
                          title="Retirer des favoris"
                        >
                          <Heart size={16} fill="#ffffff" />
                        </button>
                        <div className="mx-play-overlay">
                          <div className="mx-play-btn-circle">
                            {isCurrent && isPlaying ? <Pause size={16} fill="#ffffff" /> : <Play size={16} fill="#ffffff" style={{ marginLeft: '2px' }} />}
                          </div>
                        </div>
                      </div>
                      <h4 className="mx-card-title">{track.title}</h4>
                      <p className="mx-card-artist">{track.artist}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {currentTrack && (
        <footer className="mx-footer">
          <div className="mx-player-top-mobile">
            <div className="mx-player-left">
              <div className="mx-player-cover">
                <img src={currentTrack.cover} alt={currentTrack.title} />
              </div>
              <div className="mx-player-meta">
                <h4 className="mx-player-title">{currentTrack.title}</h4>
                <p className="mx-player-artist">{currentTrack.artist}</p>
              </div>
            </div>

            <div className="mx-player-controls" style={{ gap: '10px' }}>
              <button onClick={handlePrev} className="mx-ctrl-btn">
                <SkipBack size={18} fill="currentColor" />
              </button>
              <button
                onClick={togglePlayPause}
                disabled={isLoadingTrack}
                className="mx-play-main-btn"
              >
                {isLoadingTrack ? (
                  <Loader2 size={16} className="animate-spin" style={{ color: '#000' }} />
                ) : isPlaying ? (
                  <Pause size={16} fill="currentColor" />
                ) : (
                  <Play size={16} fill="currentColor" style={{ marginLeft: '2px' }} />
                )}
              </button>
              <button onClick={handleNext} className="mx-ctrl-btn">
                <SkipForward size={18} fill="currentColor" />
              </button>
            </div>
          </div>

          <div className="mx-player-center" style={{ width: '100%' }}>
            <div className="mx-progress-container">
              <span>{formatTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={(e) => {
                  const time = Number(e.target.value);
                  if (audioRef.current) audioRef.current.currentTime = time;
                  setCurrentTime(time);
                }}
                className="mx-range-input"
              />
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="mx-player-right">
            <button 
              onClick={() => {
                const newMuted = !isMuted;
                setIsMuted(newMuted);
                if (audioRef.current) audioRef.current.muted = newMuted;
              }}
              className="mx-ctrl-btn"
            >
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const val = Number(e.target.value);
                setVolume(val);
                setIsMuted(val === 0);
                if (audioRef.current) audioRef.current.volume = val;
              }}
              className="mx-range-input"
              style={{ width: '80px' }}
            />
          </div>
        </footer>
      )}
    </div>
  );
}