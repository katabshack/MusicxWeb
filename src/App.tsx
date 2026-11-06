import React, { useState, useRef, useEffect } from 'react';
import { Search, Play, Pause, Music, Sparkles, Loader2, SkipBack, SkipForward, Home, Library, Heart, Shuffle, Repeat, Volume2, VolumeX } from 'lucide-react';
import axios from 'axios';

interface Track {
  id: string;
  title: string;
  artist: string;
  cover: string;
}

// URL de ton tunnel Ngrok actif
const SERVER_URL = import.meta.env.PROD 
  ? 'https://foothold-magnitude-wife.ngrok-free.dev' 
  : 'http://localhost:3001';

// Configuration Axios globale pour contourner l'avertissement de Ngrok
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

  // Persistance des favoris via localStorage
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
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sauvegarde des favoris
  useEffect(() => {
    try {
      localStorage.setItem('musicx_favorites', JSON.stringify(favorites));
    } catch (e) {}
  }, [favorites]);

  const currentPlaylist = activeTab === 'home' ? searchResults : favorites;
  const currentTrack = currentTrackIndex !== null && currentPlaylist[currentTrackIndex] 
    ? currentPlaylist[currentTrackIndex] 
    : null;

  // Gestion de la recherche instantanée avec l'instance 'api' (Ngrok compatible)
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

  // Lancer la lecture d'un morceau
  const handlePlayTrack = (index: number) => {
    setCurrentTrackIndex(index);
    setIsPlaying(true);
    setIsLoadingTrack(true);
  };

  // Changement de source audio vers le serveur local / ngrok
  useEffect(() => {
    if (currentTrack && audioRef.current) {
      audioRef.current.src = `${SERVER_URL}/api/stream?id=${currentTrack.id}`;
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
    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * currentPlaylist.length);
      setCurrentTrackIndex(randomIndex);
    } else if (currentTrackIndex !== null) {
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
    <div className="flex flex-col h-screen bg-[#0a0a0c] text-white font-sans select-none overflow-hidden">
      {/* Élément Audio Caché */}
      <audio
        ref={audioRef}
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
        onEnded={() => {
          if (isRepeat && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play();
          } else {
            handleNext();
          }
        }}
      />

      {/* Barre de Navigation Supérieure */}
      <header className="flex items-center justify-between px-6 py-4 bg-[#121216] border-b border-white/5 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center shadow-lg shadow-red-600/20">
            <Music className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-wide bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            MusicX
          </span>
        </div>

        {/* Barre de recherche */}
        <div className="relative w-full max-w-md mx-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Rechercher un artiste, un titre..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-zinc-900/80 border border-white/10 rounded-full pl-11 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all"
          />
          {loading && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500 animate-spin" />
          )}
        </div>

        {/* Onglets de navigation */}
        <div className="flex items-center gap-2 bg-zinc-900/60 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'home' 
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Accueil</span>
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'library' 
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Library className="w-4 h-4" />
            <span>Biblio ({favorites.length})</span>
          </button>
        </div>
      </header>

      {/* Contenu Principal */}
      <main className="flex-1 overflow-y-auto px-6 py-6">
        {activeTab === 'home' ? (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-zinc-200">
              {query ? `Résultats de recherche` : "Découverte"}
            </h2>

            {searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center mb-4 text-red-500 shadow-inner">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-2">Bienvenue sur MusicX</h3>
                <p className="text-zinc-500 text-sm max-w-sm">
                  Recherche un artiste pour lancer la liste de lecture en continu.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {searchResults.map((track, index) => {
                  const isFav = favorites.some(t => t.id === track.id);
                  const isCurrent = currentTrack?.id === track.id;

                  return (
                    <div
                      key={track.id}
                      onClick={() => handlePlayTrack(index)}
                      className={`group relative bg-zinc-900/40 hover:bg-zinc-900 p-3 rounded-2xl border transition-all cursor-pointer flex flex-col ${
                        isCurrent ? 'border-red-500/50 bg-zinc-900/80 shadow-lg shadow-red-500/10' : 'border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-zinc-800">
                        <img 
                          src={track.cover} 
                          alt={track.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <button
                          onClick={(e) => toggleFavorite(track, e)}
                          className={`absolute top-2 right-2 p-2 rounded-xl backdrop-blur-md transition-all ${
                            isFav ? 'bg-red-600 text-white' : 'bg-black/40 text-white/70 hover:text-white opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${isFav ? 'fill-white' : ''}`} />
                        </button>
                        <div className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] items-center justify-center transition-opacity ${
                          isCurrent ? 'flex' : 'opacity-0 group-hover:flex'
                        }`}>
                          <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/50">
                            {isCurrent && isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
                          </div>
                        </div>
                      </div>
                      <h4 className="font-medium text-sm truncate text-zinc-200 group-hover:text-white">
                        {track.title}
                      </h4>
                      <p className="text-xs text-zinc-500 truncate mt-1">
                        {track.artist}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-zinc-200">Ma Bibliothèque</h2>
            {favorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center mb-4 text-zinc-500">
                  <Heart className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-2">Aucun favori pour l'instant</h3>
                <p className="text-zinc-500 text-sm max-w-sm">
                  Ajoute des musiques à tes favoris en cliquant sur le cœur lors de tes recherches.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {favorites.map((track, index) => {
                  const isCurrent = currentTrack?.id === track.id;

                  return (
                    <div
                      key={track.id}
                      onClick={() => handlePlayTrack(index)}
                      className={`group relative bg-zinc-900/40 hover:bg-zinc-900 p-3 rounded-2xl border transition-all cursor-pointer flex flex-col ${
                        isCurrent ? 'border-red-500/50 bg-zinc-900/80 shadow-lg shadow-red-500/10' : 'border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-zinc-800">
                        <img 
                          src={track.cover} 
                          alt={track.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <button
                          onClick={(e) => toggleFavorite(track, e)}
                          className="absolute top-2 right-2 p-2 rounded-xl backdrop-blur-md bg-red-600 text-white transition-all"
                        >
                          <Heart className="w-4 h-4 fill-white" />
                        </button>
                        <div className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] items-center justify-center transition-opacity ${
                          isCurrent ? 'flex' : 'opacity-0 group-hover:flex'
                        }`}>
                          <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/50">
                            {isCurrent && isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
                          </div>
                        </div>
                      </div>
                      <h4 className="font-medium text-sm truncate text-zinc-200 group-hover:text-white">
                        {track.title}
                      </h4>
                      <p className="text-xs text-zinc-500 truncate mt-1">
                        {track.artist}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Barre de Lecture Inférieure (Player) */}
      {currentTrack && (
        <footer className="h-24 bg-[#121216] border-t border-white/5 px-6 flex items-center justify-between gap-4 z-20">
          {/* Info Piste */}
          <div className="flex items-center gap-3 w-1/4 min-w-[200px]">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0">
              <img src={currentTrack.cover} alt={currentTrack.title} className="w-full h-full object-cover" />
            </div>
            <div className="overflow-hidden">
              <h4 className="text-sm font-medium truncate text-white">{currentTrack.title}</h4>
              <p className="text-xs text-zinc-500 truncate mt-0.5">{currentTrack.artist}</p>
            </div>
          </div>

          {/* Contrôles du Lecteur */}
          <div className="flex flex-col items-center max-w-xl w-2/4 gap-2">
            <div className="flex items-center gap-5">
              <button 
                onClick={() => setIsShuffle(!isShuffle)}
                className={`text-zinc-400 hover:text-white transition-colors ${isShuffle ? 'text-red-500' : ''}`}
              >
                <Shuffle className="w-4 h-4" />
              </button>
              <button 
                onClick={handlePrev}
                className="text-zinc-300 hover:text-white transition-colors"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>
              <button
                onClick={togglePlayPause}
                disabled={isLoadingTrack}
                className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-all shadow-lg"
              >
                {isLoadingTrack ? (
                  <Loader2 className="w-5 h-5 animate-spin text-black" />
                ) : isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>
              <button 
                onClick={handleNext}
                className="text-zinc-300 hover:text-white transition-colors"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>
              <button 
                onClick={() => setIsRepeat(!isRepeat)}
                className={`text-zinc-400 hover:text-white transition-colors ${isRepeat ? 'text-red-500' : ''}`}
              >
                <Repeat className="w-4 h-4" />
              </button>
            </div>

            {/* Barre de progression */}
            <div className="flex items-center gap-3 w-full text-xs text-zinc-500">
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
                className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600 hover:accent-red-500"
              />
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Volume */}
          <div className="flex items-center justify-end gap-3 w-1/4 min-w-[200px]">
            <button 
              onClick={() => {
                const newMuted = !isMuted;
                setIsMuted(newMuted);
                if (audioRef.current) audioRef.current.muted = newMuted;
              }}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
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
              className="w-24 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600 hover:accent-red-500"
            />
          </div>
        </footer>
      )}
    </div>
  );
}