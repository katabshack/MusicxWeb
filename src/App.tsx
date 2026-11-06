import React, { useState, useRef, useEffect } from 'react';
import { Search, Play, Pause, Music, Sparkles, Loader2, SkipBack, SkipForward, Home, Library, Heart, Shuffle, Repeat, Volume2, VolumeX, Download } from 'lucide-react';
import axios from 'axios';

interface Track {
  id: string;
  title: string;
  artist: string;
  cover: string;
}

const SERVER_URL = 'http://localhost:3001';

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

  // Nouveaux états (Shuffle, Loop, Volume)
  const [isShuffle, setIsShuffle] = useState(false);
  const [isLoop, setIsLoop] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(1);

  // États pour la barre de progression
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentList = activeTab === 'home' ? searchResults : favorites;

  // Sauvegarder les favoris à chaque modification
  useEffect(() => {
    try {
      localStorage.setItem('musicx_favorites', JSON.stringify(favorites));
    } catch (e) {
      console.error("Erreur de sauvegarde des favoris", e);
    }
  }, [favorites]);

  const searchMusic = async (searchQuery: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`${SERVER_URL}/api/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(res.data);
    } catch (err) {
      console.error("Erreur de recherche:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setActiveTab('home');
      searchMusic(query);
    }
  };

  const playTrackByIndex = (index: number) => {
    if (index < 0 || index >= currentList.length) return;

    if (currentTrackIndex === index && activeTab === (searchResults.includes(currentList[index]) ? 'home' : 'library')) {
      togglePlay();
      return;
    }

    setCurrentTrackIndex(index);
    setIsLoadingTrack(true);
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (!audioRef.current || currentTrackIndex === null) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => console.error("Erreur de lecture audio:", err));
    }
  };

  const handleNext = () => {
    if (currentTrackIndex === null || currentList.length === 0) return;

    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * currentList.length);
      playTrackByIndex(randomIndex);
    } else {
      const nextIndex = (currentTrackIndex + 1) % currentList.length;
      playTrackByIndex(nextIndex);
    }
  };

  const handlePrev = () => {
    if (currentTrackIndex === null || currentList.length === 0) return;
    const prevIndex = (currentTrackIndex - 1 + currentList.length) % currentList.length;
    playTrackByIndex(prevIndex);
  };

  const handleEnded = () => {
    if (isLoop && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    } else {
      handleNext();
    }
  };

  const toggleFavorite = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    if (favorites.some(fav => fav.id === track.id)) {
      setFavorites(favorites.filter(fav => fav.id !== track.id));
    } else {
      setFavorites([...favorites, track]);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      setVolume(previousVolume);
      if (audioRef.current) audioRef.current.volume = previousVolume;
    } else {
      setPreviousVolume(volume);
      setIsMuted(true);
      setVolume(0);
      if (audioRef.current) audioRef.current.volume = 0;
    }
  };

  // Charger la source audio dès que l'index change
  useEffect(() => {
    if (currentTrackIndex !== null && currentList[currentTrackIndex] && audioRef.current) {
      const track = currentList[currentTrackIndex];
      setIsLoadingTrack(true);
      audioRef.current.src = `${SERVER_URL}/api/stream?id=${track.id}`;
      audioRef.current.load();
    }
  }, [currentTrackIndex, activeTab]);

  const handleCanPlay = () => {
    setIsLoadingTrack(false);
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    audioRef.current?.play().then(() => {
      setIsPlaying(true);
    }).catch(err => {
      console.error("Lecture automatique bloquée:", err);
      setIsPlaying(false);
    });
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const currentTrack = currentTrackIndex !== null && currentList[currentTrackIndex] ? currentList[currentTrackIndex] : null;

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '110px', backgroundColor: '#121212', color: '#fff', fontFamily: 'sans-serif' }}>
      
      {/* Élément audio HTML5 */}
      <audio
        ref={audioRef}
        onCanPlay={handleCanPlay}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={() => {
          setIsLoadingTrack(false);
          setIsPlaying(false);
          console.error("Erreur sur le flux audio");
        }}
      />

      {/* Header / Navigation & Recherche */}
      <header style={{
        padding: '16px 20px',
        backgroundColor: '#000000',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #282828'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div 
            onClick={() => setActiveTab('home')} 
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          >
            <Music color="#E50914" size={28} />
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#E50914', margin: 0 }}>
              MusicX
            </h1>
          </div>

          <nav style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setActiveTab('home')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: activeTab === 'home' ? '#282828' : 'transparent',
                color: activeTab === 'home' ? '#fff' : '#b3b3b3',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500'
              }}
            >
              <Home size={16} /> Accueil
            </button>
            <button
              onClick={() => setActiveTab('library')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: activeTab === 'library' ? '#282828' : 'transparent',
                color: activeTab === 'library' ? '#fff' : '#b3b3b3',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500'
              }}
            >
              <Library size={16} /> Bibliothèque ({favorites.length})
            </button>
          </nav>
        </div>

        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flex: 1, maxWidth: '380px', marginLeft: '16px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#b3b3b3' }} size={16} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un artiste, un son..."
              style={{
                width: '100%',
                padding: '10px 10px 10px 38px',
                borderRadius: '50px',
                backgroundColor: '#242424',
                border: 'none',
                color: '#fff',
                outline: 'none',
                fontSize: '14px'
              }}
            />
          </div>
        </form>
      </header>

      {/* Contenu principal */}
      <main style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        {activeTab === 'home' ? (
          <section>
            <h2 style={{ fontSize: '18px', marginBottom: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={18} color="#E50914" /> Résultats de recherche
            </h2>
            {loading ? (
              <p style={{ color: '#b3b3b3' }}>Recherche en cours...</p>
            ) : searchResults.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '16px'
              }}>
                {searchResults.map((track, index) => {
                  const isFav = favorites.some(fav => fav.id === track.id);
                  const isCurrent = currentTrackIndex === index && activeTab === 'home';
                  return (
                    <div
                      key={track.id}
                      onClick={() => playTrackByIndex(index)}
                      style={{
                        backgroundColor: isCurrent ? '#282828' : '#181818',
                        padding: '14px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: isCurrent ? '1px solid #E50914' : '1px solid transparent',
                        transition: 'background-color 0.2s',
                        position: 'relative'
                      }}
                    >
                      <div style={{ position: 'relative' }}>
                        <img
                          src={track.cover}
                          alt={track.title}
                          style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: '6px', marginBottom: '10px' }}
                        />
                        {/* Bouton Favori */}
                        <button
                          onClick={(e) => toggleFavorite(track, e)}
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <Heart size={14} color={isFav ? '#E50914' : '#fff'} fill={isFav ? '#E50914' : 'none'} />
                        </button>
                      </div>
                      <h3 style={{ fontSize: '13px', color: '#fff', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: '0 0 4px 0' }}>
                        {track.title}
                      </h3>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ fontSize: '11px', color: '#b3b3b3', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '110px' }}>
                          {track.artist}
                        </p>
                        {/* Bouton de téléchargement direct du MP3 */}
                        <a
                          href={`${SERVER_URL}/api/stream?id=${track.id}`}
                          download={`${track.title}.mp3`}
                          onClick={(e) => e.stopPropagation()}
                          title="Télécharger le MP3"
                          style={{ color: '#b3b3b3', display: 'flex', alignItems: 'center' }}
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <section style={{ textAlign: 'center', marginTop: '60px' }}>
                <Sparkles color="#E50914" size={36} style={{ marginBottom: '10px' }} />
                <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#fff' }}>Bienvenue sur MusicX</h2>
                <p style={{ fontSize: '13px', color: '#b3b3b3' }}>
                  Recherche un artiste pour lancer ta liste de lecture en continu.
                </p>
              </section>
            )}
          </section>
        ) : (
          <section>
            <h2 style={{ fontSize: '18px', marginBottom: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Library size={18} color="#E50914" /> Mes Morceaux Favoris
            </h2>
            {favorites.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '16px'
              }}>
                {favorites.map((track, index) => {
                  const isCurrent = currentTrackIndex === index && activeTab === 'library';
                  return (
                    <div
                      key={track.id}
                      onClick={() => playTrackByIndex(index)}
                      style={{
                        backgroundColor: isCurrent ? '#282828' : '#181818',
                        padding: '14px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: isCurrent ? '1px solid #E50914' : '1px solid transparent',
                        transition: 'background-color 0.2s',
                        position: 'relative'
                      }}
                    >
                      <div style={{ position: 'relative' }}>
                        <img
                          src={track.cover}
                          alt={track.title}
                          style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: '6px', marginBottom: '10px' }}
                        />
                        <button
                          onClick={(e) => toggleFavorite(track, e)}
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <Heart size={14} color="#E50914" fill="#E50914" />
                        </button>
                      </div>
                      <h3 style={{ fontSize: '13px', color: '#fff', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: '0 0 4px 0' }}>
                        {track.title}
                      </h3>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ fontSize: '11px', color: '#b3b3b3', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '110px' }}>
                          {track.artist}
                        </p>
                        <a
                          href={`${SERVER_URL}/api/stream?id=${track.id}`}
                          download={`${track.title}.mp3`}
                          onClick={(e) => e.stopPropagation()}
                          title="Télécharger le MP3"
                          style={{ color: '#b3b3b3', display: 'flex', alignItems: 'center' }}
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: '#b3b3b3', textAlign: 'center', marginTop: '40px' }}>
                Aucun favori pour le moment. Clique sur l'icône cœur d'une chanson pour l'ajouter ici !
              </p>
            )}
          </section>
        )}
      </main>

      {/* Lecteur fixe en bas */}
      {currentTrack && (
        <footer style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '90px',
          backgroundColor: '#000000',
          borderTop: '1px solid #282828',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '10px 20px',
          zIndex: 100
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            
            {/* Info Piste */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '30%', overflow: 'hidden' }}>
              <img src={currentTrack.cover} alt="" style={{ width: '45px', height: '45px', borderRadius: '4px', objectFit: 'cover' }} />
              <div style={{ overflow: 'hidden' }}>
                <div style={{ color: '#fff', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.title}</div>
                <div style={{ color: '#b3b3b3', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.artist}</div>
              </div>
            </div>

            {/* Contrôles du lecteur (Shuffle, Prev, Play/Pause, Next, Loop) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                onClick={() => setIsShuffle(!isShuffle)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: isShuffle ? '#E50914' : '#b3b3b3', display: 'flex', alignItems: 'center' }}
                title="Mode Aléatoire"
              >
                <Shuffle size={18} />
              </button>

              <button
                onClick={handlePrev}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b3b3b3', display: 'flex', alignItems: 'center' }}
                title="Précédent"
              >
                <SkipBack size={20} />
              </button>

              <button
                onClick={togglePlay}
                disabled={isLoadingTrack}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: '#E50914',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isLoadingTrack ? 'wait' : 'pointer',
                  opacity: isLoadingTrack ? 0.7 : 1
                }}
              >
                {isLoadingTrack ? (
                  <Loader2 size={16} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
                ) : isPlaying ? (
                  <Pause size={16} color="#fff" />
                ) : (
                  <Play size={16} color="#fff" style={{ marginLeft: '2px' }} />
                )}
              </button>

              <button
                onClick={handleNext}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center' }}
                title="Suivant"
              >
                <SkipForward size={20} />
              </button>

              <button
                onClick={() => setIsLoop(!isLoop)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: isLoop ? '#E50914' : '#b3b3b3', display: 'flex', alignItems: 'center' }}
                title="Répéter"
              >
                <Repeat size={18} />
              </button>
            </div>

            {/* Gestion du volume à droite */}
            <div style={{ width: '30%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={toggleMute}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b3b3b3', display: 'flex', alignItems: 'center' }}
                title={isMuted ? "Activer le son" : "Couper le son"}
              >
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={handleVolumeChange}
                style={{
                  width: '90px',
                  accentColor: '#E50914',
                  height: '4px',
                  cursor: 'pointer'
                }}
              />
            </div>
          </div>

          {/* Barre de progression */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', paddingBottom: '4px' }}>
            <span style={{ fontSize: '10px', color: '#b3b3b3', minWidth: '35px', textAlign: 'right' }}>
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              style={{
                flex: 1,
                accentColor: '#E50914',
                height: '4px',
                cursor: 'pointer'
              }}
            />
            <span style={{ fontSize: '10px', color: '#b3b3b3', minWidth: '35px' }}>
              {formatTime(duration)}
            </span>
          </div>
        </footer>
      )}
    </div>
  );
}