import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Papa from 'papaparse';
import Sticker from './components/Sticker';
import GlassCard from './components/GlassCard';
import ContactModal from './components/ContactModal';
import './App.css';

// Higher value = more subtle parallax movement
const PARALLAX_FACTOR = 100;
const NEAR_THRESHOLD = 0.65;
const FAR_THRESHOLD = 0.25;

function App() {
  const [stickers, setStickers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [generatedStickers, setGeneratedStickers] = useState([]);
  const mainRef = useRef(null);
  const profileRef = useRef(null);

  const [proximity, setProximity] = useState(0);
  const [isMobileView, setIsMobileView] = useState(false);
  const [altProfile, setAltProfile] = useState(false);

  useEffect(() => {
    // Load sticker data from CSV
    fetch('/data/links.csv')
      .then((response) => response.text())
      .then((csvText) => {
        Papa.parse(csvText, {
          header: true,
          complete: (results) => {
            const validData = results.data.filter(
              (row) => row.image && row.link
            );
            setStickers(validData);
          },
        });
      });
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isMobileView) {
      setProximity(altProfile ? 1 : 0);
      return;
    }

    const handleMouseMove = (e) => {
      if (!profileRef.current) return;
      const rect = profileRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      const maxDist = Math.max(rect.width, rect.height) * 2;
      const closeness = Math.max(0, Math.min(1, 1 - dist / maxDist));

      let next = 0;
      if (closeness >= NEAR_THRESHOLD) {
        next = 1;
      } else if (closeness <= FAR_THRESHOLD) {
        next = 0;
      } else {
        next = (closeness - FAR_THRESHOLD) / (NEAR_THRESHOLD - FAR_THRESHOLD);
      }
      setProximity(next);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isMobileView, altProfile]);

  useEffect(() => {
    if (stickers.length === 0) return;

    const generateLayout = () => {
      const newStickers = [];
      const { innerWidth, innerHeight } = window;
      const isMobileLayout = innerWidth <= 640;
      const safeRect = mainRef.current?.getBoundingClientRect();

      // Calculate density and target count
      // Base: 25 stickers for 1920x1080 (approx 2M pixels)
      const pixelArea = innerWidth * innerHeight;
      console.log(`Window size: ${innerWidth}x${innerHeight}`);
      const baseArea = 1920 * 1080;
      const ratio = pixelArea / baseArea; // Linear scale factor

      const totalStickers = Math.max(15, Math.floor(20 * ratio));
      console.log(
        `Generating ${totalStickers} stickers for area ${pixelArea} with ratio ${ratio.toFixed(
          2
        )}`
      );

      // Dynamic scale - Increased base size as requested
      const baseScale = Math.max(0.5, Math.min(1.5, ratio * 1.2));

      // Safe zone based on actual main content size
      const paddingPx = 24; // breathing room around the UI
      let safeZone = null;
      if (!isMobileLayout) {
        if (safeRect) {
          const xMin = ((safeRect.left - paddingPx) / innerWidth) * 100;
          const xMax = ((safeRect.right + paddingPx) / innerWidth) * 100;
          const yMin = ((safeRect.top - paddingPx) / innerHeight) * 100;
          const yMax = ((safeRect.bottom + paddingPx) / innerHeight) * 100;
          safeZone = {
            xMin: Math.max(0, xMin),
            xMax: Math.min(100, xMax),
            yMin: Math.max(0, yMin),
            yMax: Math.min(100, yMax),
          };
        } else {
          // fallback if ref unavailable
          const uiWidth = Math.min(1000, innerWidth * 0.9);
          const uiHeight = Math.min(800, innerHeight * 0.8);
          const xSafePct = (uiWidth / innerWidth) * 100;
          const ySafePct = (uiHeight / innerHeight) * 100;
          safeZone = {
            xMin: 50 - xSafePct / 2 - 2,
            xMax: 50 + xSafePct / 2 + 2,
            yMin: 50 - ySafePct / 2 - 2,
            yMax: 50 + ySafePct / 2 + 2,
          };
        }
      }

      // Minimum distance between stickers
      const minDistance = 18; // Increased slightly

      for (let i = 0; i < totalStickers; i++) {
        const stickerData = stickers[i % stickers.length];
        let attempts = 0;
        let position = null;

        while (attempts < 100 && !position) {
          // Keep away from edges (8% - 93%) to prevent clipping
          const x = Math.random() * 100 - 5;
          const y = Math.random() * 100 - 5;

          // 1. Check Safe Zone
          if (
            safeZone &&
            x > safeZone.xMin &&
            x < safeZone.xMax &&
            y > safeZone.yMin &&
            y < safeZone.yMax
          ) {
            attempts++;
            continue;
          }

          // 2. Check Distance to existing stickers
          let tooClose = false;
          for (const existing of newStickers) {
            const dx = existing.leftVal - x;
            const dy = (existing.topVal - y) * (innerHeight / innerWidth); // Correct for aspect ratio
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDistance) {
              tooClose = true;
              break;
            }
          }

          if (tooClose) {
            attempts++;
            continue;
          }

          position = {
            left: `${x}%`,
            top: `${y}%`,
            leftVal: x, // Store for distance calc
            topVal: y,
            rotation: (Math.random() - 0.5) * 60,
            scale: baseScale * (0.9 + Math.random() * 0.4), // Increased variation min
          };
        }

        if (position) {
          newStickers.push({ ...stickerData, ...position });
        }
      }
      console.log(
        `Attempted to place ${totalStickers} stickers, placed ${newStickers.length}`
      );
      setGeneratedStickers(newStickers);
    };

    generateLayout();

    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(generateLayout, 200); // Debounce
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [stickers]);

  return (
    <div className='app-container'>
      <div className='version-badge'>v0.1</div>
      {/* Background Stickers */}
      <div className='sticker-layer'>
        {generatedStickers.map((sticker, index) => (
          <Sticker
            key={index}
            src={`/bg_icons/${sticker.image}`}
            link={sticker.link}
            initialX={sticker.left}
            initialY={sticker.top}
            rotation={sticker.rotation}
            scale={sticker.scale}
            parallaxFactor={PARALLAX_FACTOR}
          />
        ))}
      </div>

      {/* Main Content */}
      <main className='main-content' ref={mainRef}>
        <section className='hero'>
          <h1 className='hero-title'>
            <span className='hero-line'>Better Techniques</span>
            <span className='hero-line '>Equals</span>
            <span className='hero-line hero-highlight'>More Fun!</span>
          </h1>
          <div
            className='profile-image'
            ref={profileRef}
            onClick={() => {
              if (isMobileView) setAltProfile((prev) => !prev);
            }}
          >
            <motion.img
              className='profile-img profile-img--base'
              src='/Profile%20pic.png'
              alt='Profile'
              initial={{ opacity: 1, scale: 1 }}
              animate={{
                opacity: 1 - proximity,
                scale: 1 - proximity * 0.08,
              }}
              transition={{ type: 'spring', stiffness: 160, damping: 20 }}
            />
            <motion.img
              className='profile-img profile-img--alt'
              src='/Prifile%20pic2.png'
              alt='Profile 2'
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{
                opacity: proximity,
                scale: 0.9 + proximity * 0.2,
              }}
              transition={{ type: 'spring', stiffness: 160, damping: 20 }}
            />
          </div>
        </section>

        {/* Glass Cards Area */}
        <div className='glass-cards-container'>
          {/* Survey Card */}
          <GlassCard className='action-card'>
            <h3>Survey & Referral</h3>
            <p>Fill out the survey to get the price, or refer a friend!</p>
            <div className='button-group'>
              <a href='/survey' className='btn btn-primary'>
                Fill Survey
              </a>
              <a href='/referral' className='btn btn-secondary'>
                Referral
              </a>
            </div>
          </GlassCard>

          {/* Booking Card */}
          <GlassCard className='action-card'>
            <h3>Book a Lesson</h3>
            <p>Ready to hit the slopes? Book your session now.</p>
            <div className='button-group'>
              <button
                onClick={() => setIsModalOpen(true)}
                className='btn btn-primary'
              >
                Book Now
              </button>
            </div>
          </GlassCard>
        </div>
      </main>

      <ContactModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}

export default App;
