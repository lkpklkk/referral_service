import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import Papa from 'papaparse';
import Sticker from './components/Sticker';
import GlassCard from './components/GlassCard';
import ContactModal from './components/ContactModal';
import './App.css';

// Higher value = more subtle parallax movement
const PARALLAX_FACTOR = 100;
const PARALLAX_FACTOR_MOBILE = 20; // More sensitive for mobile gyroscope
const NEAR_THRESHOLD = 0.65;
const FAR_THRESHOLD = 0.25;

const FORM_URL_EN = import.meta.env.VITE_FORM_URL || '';
const FORM_URL_CN = import.meta.env.VITE_FORM_URL_CN || '';

const translations = {
  en: {
    heroLine1: 'Better Techniques',
    heroLine2: '=',
    heroLine3: '',
    heroLine3Highlight: 'More Fun!',
    surveyTitle: 'Survey',
    surveyDesc:
      'Share your thoughts and win free lessons + UberEats gift card!',
    surveyCta: 'Fill Survey',
    referralCta: 'Share',
    bookTitle: 'Book a Lesson',
    bookDesc: 'Wanna book a lesson? Or chat first? Click below.',
    bookCta: 'Book Now',
    contactCta: "Let's Chat",
    selectLabel: 'Language',
    modalTitle: 'Contact Me',
    modalDesc: 'Feel free to reach out through any of the channels below:',
    contactWhatsApp: 'WhatsApp',
    contactWeChat: 'WeChat',
    contactXhs: 'Xiaohongshu',
  },
  zh: {
    heroLine1: '好的技术',
    heroLine2: '=',
    heroLine3: '滑得',
    heroLine3Highlight: '更开心！',
    surveyTitle: '调查问卷',
    surveyDesc: '有奖调查问卷，填写问卷或推荐好友即可中奖！',
    surveyCta: '填写问卷',
    referralCta: '推荐好友',
    bookTitle: '滑雪课',
    bookDesc: '预约滑雪课，或者找我聊天嘻嘻，点击下方按钮。',
    bookCta: '立即预约',
    contactCta: '聊聊先',
    selectLabel: '语言',
    modalTitle: '联系我',
    modalDesc: '可以通过以下方式联系我：',
    contactWhatsApp: 'WhatsApp',
    contactWeChat: '微信',
    contactXhs: '小红书',
  },
};

function App() {
  const [stickers, setStickers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generatedStickers, setGeneratedStickers] = useState([]);
  const mainRef = useRef(null);
  const profileRef = useRef(null);

  const [proximity, setProximity] = useState(0);
  const [isMobileView, setIsMobileView] = useState(false);
  const [altProfile, setAltProfile] = useState(false);
  const [language, setLanguage] = useState('en');
  const [gyroscopeEnabled, setGyroscopeEnabled] = useState(false);

  const handleEnableGyroscope = useCallback(async () => {
    if (gyroscopeEnabled) {
      setGyroscopeEnabled(false);
      return;
    }

    if (typeof window === 'undefined') return;
    const DeviceOrientation = window.DeviceOrientationEvent;

    if (typeof DeviceOrientation?.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientation.requestPermission();
        if (permission === 'granted') {
          setGyroscopeEnabled(true);
        }
      } catch (error) {
        console.error('Permission error:', error);
      }
    } else {
      // Non-iOS devices usually don't need permission or don't support the API
      setGyroscopeEnabled(true);
    }
  }, [gyroscopeEnabled]);

  const handleSurveyClick = () => {
    const targetUrl = language === 'zh' ? FORM_URL_CN : FORM_URL_EN;
    const fallback = '/survey';
    const url = targetUrl || fallback;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

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
    const storedLang = localStorage.getItem('siteLanguage');
    if (storedLang && translations[storedLang]) {
      setLanguage(storedLang);
      return;
    }
    const navLang = (navigator.language || navigator.userLanguage || 'en')
      .toLowerCase()
      .slice(0, 2);
    if (navLang === 'zh' || navLang === 'cn') {
      setLanguage('zh');
    } else {
      setLanguage('en');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('siteLanguage', language);
  }, [language]);

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
      const safeRect = mainRef.current?.getBoundingClientRect();

      const EXCLUSION_BUFFER_PX = -50;
      const STICKER_BASE_WIDTH = 300;
      const STICKER_BASE_HEIGHT = 300;

      // Calculate sticker count based on screen size
      const pixelArea = innerWidth * innerHeight;
      const baseArea = 1920 * 1080;
      const ratio = pixelArea / baseArea;
      const totalStickers = Math.max(10, Math.floor(20 * ratio));

      const baseScale = Math.max(0.5, Math.min(1.5, ratio * 1.2));

      // Collect exclusion zones for key text elements
      const exclusionZones = [];
      const exclusionSelectors = [
        '.hero-title',
        '.tap-hint-svg',
        '.tap-hint-svg-text',
      ];

      for (const selector of exclusionSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const rect = element.getBoundingClientRect();
          const bufferPctX = (EXCLUSION_BUFFER_PX / innerWidth) * 100;
          const bufferPctY = (EXCLUSION_BUFFER_PX / innerHeight) * 100;
          exclusionZones.push({
            xMin: (rect.left / innerWidth) * 100 - bufferPctX,
            xMax: (rect.right / innerWidth) * 100 + bufferPctX,
            yMin: (rect.top / innerHeight) * 100 - bufferPctY,
            yMax: (rect.bottom / innerHeight) * 100 + bufferPctY,
            name: selector,
          });
        }
      }

      // Safe zone based on actual main content size
      const paddingPx = 24; // breathing room around the UI
      let safeZone = null;
      if (!isMobileView) {
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

      // Helper function to check if sticker overlaps with any exclusion zone
      const overlapsExclusionZone = (x, y, scale) => {
        // Calculate sticker bounding box in percentage
        const stickerWidthPct =
          ((STICKER_BASE_WIDTH * scale) / innerWidth) * 100;
        const stickerHeightPct =
          ((STICKER_BASE_HEIGHT * scale) / innerHeight) * 100;

        // Sticker position is at its center (left/top in CSS), so calculate bounds
        const stickerXMin = x - stickerWidthPct / 2;
        const stickerXMax = x + stickerWidthPct / 2;
        const stickerYMin = y - stickerHeightPct / 2;
        const stickerYMax = y + stickerHeightPct / 2;

        // Check overlap with each exclusion zone
        for (const zone of exclusionZones) {
          // AABB (Axis-Aligned Bounding Box) collision detection
          const overlapsX = stickerXMax > zone.xMin && stickerXMin < zone.xMax;
          const overlapsY = stickerYMax > zone.yMin && stickerYMin < zone.yMax;

          if (overlapsX && overlapsY) {
            return true; // Collision detected
          }
        }
        return false;
      };

      // Grid-based placement with jitter for even distribution
      const aspectRatio = innerWidth / innerHeight;
      const gridRows = Math.ceil(Math.sqrt(totalStickers / aspectRatio));
      const gridCols = Math.ceil(totalStickers / gridRows);

      // Create array of all grid cells
      const gridCells = [];
      for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
          gridCells.push({ row, col });
        }
      }

      // Shuffle grid cells for random order
      for (let i = gridCells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gridCells[i], gridCells[j]] = [gridCells[j], gridCells[i]];
      }

      // Cell dimensions in percentage
      const cellWidth = 100 / gridCols;
      const cellHeight = 100 / gridRows;

      const jitterX = cellWidth * 0.5;
      const jitterY = cellHeight * 0.5;

      let cellIndex = 0; // Track which grid cell we're trying
      for (let i = 0; i < totalStickers; i++) {
        const stickerData = stickers[i % stickers.length];
        let attempts = 0;
        let position = null;

        // Try multiple grid cells if needed
        while (
          attempts < gridCells.length &&
          !position &&
          cellIndex < gridCells.length
        ) {
          const cell = gridCells[cellIndex];

          // Calculate cell center
          const cellCenterX = (cell.col + 0.5) * cellWidth;
          const cellCenterY = (cell.row + 0.5) * cellHeight;

          // Add jitter (random offset from center)
          const x = cellCenterX + (Math.random() - 0.5) * jitterX;
          const y = cellCenterY + (Math.random() - 0.5) * jitterY;

          // Calculate scale for this sticker
          const stickerScale = baseScale * (0.9 + Math.random() * 0.4);

          // Keep within bounds
          const inBounds = x >= 0 && x <= 100 && y >= 0 && y <= 100;

          // Check Safe Zone (main content area)
          const inSafeZone =
            safeZone &&
            x > safeZone.xMin &&
            x < safeZone.xMax &&
            y > safeZone.yMin &&
            y < safeZone.yMax;

          // Check overlap with exclusion zones
          const overlapsExclusion = overlapsExclusionZone(x, y, stickerScale);

          // If this cell works, use it
          if (inBounds && !inSafeZone && !overlapsExclusion) {
            // Adjust for top-left corner positioning
            // Since CSS positions top-left corner, subtract half dimensions to center
            const stickerWidthPct =
              ((STICKER_BASE_WIDTH * stickerScale) / innerWidth) * 100;
            const stickerHeightPct =
              ((STICKER_BASE_HEIGHT * stickerScale) / innerHeight) * 100;

            const adjustedX = x - stickerWidthPct / 2;
            const adjustedY = y - stickerHeightPct / 2;

            position = {
              left: `${adjustedX}%`,
              top: `${adjustedY}%`,
              rotation: (Math.random() - 0.5) * 60,
              scale: stickerScale,
            };
          } else {
            // This cell didn't work, try next cell
            cellIndex++;
            attempts++;
          }
        }

        if (position) {
          newStickers.push({ ...stickerData, ...position });
          cellIndex++; // Move to next cell for next sticker
        }
      }
      setGeneratedStickers(newStickers);
    };

    generateLayout();

    let timeoutId;
    let lastWidth = window.innerWidth;

    const handleResize = () => {
      // On mobile, scrolling can trigger resize due to address bar showing/hiding
      // Only regenerate if width changes significantly
      if (window.innerWidth !== lastWidth) {
        lastWidth = window.innerWidth;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(generateLayout, 200); // Debounce
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [stickers, isMobileView]);

  return (
    <div className='app-container'>
      <div className='ui-overlay'>
        <div className='overlay-row'>
          <div className='language-switcher'>
            <label htmlFor='lang-select'>
              {translations[language].selectLabel}:
            </label>
            <select
              id='lang-select'
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value='en'>EN</option>
              <option value='zh'>中文</option>
            </select>
          </div>
          <div className='version-badge'>v0.1 (still a baby)</div>
        </div>
        {isMobileView && (
          <div className='overlay-row'>
            <button
              className='gyroscope-button'
              onClick={handleEnableGyroscope}
            >
              <span className='gyroscope-icon'>
                {gyroscopeEnabled ? '📴' : '📱'}
              </span>
              <span>
                {gyroscopeEnabled ? 'Disable Gyroscope' : 'Enable Gyroscope'}
              </span>
            </button>
          </div>
        )}
      </div>
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
            parallaxFactor={
              isMobileView ? PARALLAX_FACTOR_MOBILE : PARALLAX_FACTOR
            }
            gyroscopeEnabled={gyroscopeEnabled}
          />
        ))}
      </div>

      {/* Main Content */}
      <main className='main-content' ref={mainRef}>
        <section className='hero'>
          <h1 className='hero-title'>
            <span className='hero-line'>
              {translations[language].heroLine1}
            </span>
            <span className='hero-line'>
              {translations[language].heroLine2}
            </span>
            <span className='hero-line'>
              {translations[language].heroLine3}
              <span className='hero-line hero-highlight'>
                {translations[language].heroLine3Highlight}
              </span>
            </span>
          </h1>
          <div
            className='profile-image'
            ref={profileRef}
            onClick={() => {
              if (isMobileView) setAltProfile((prev) => !prev);
            }}
          >
            {isMobileView && (
              <>
                <img
                  className='tap-hint-svg'
                  src='/Arrow%201.svg'
                  alt=''
                  aria-hidden='true'
                />
                <span className='tap-hint-svg-text'>click me !</span>
              </>
            )}
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
            <h3>{translations[language].surveyTitle}</h3>
            <p>{translations[language].surveyDesc}</p>
            <div className='button-row'>
              <button onClick={handleSurveyClick} className='btn btn-primary'>
                <span className='btn-icon' aria-hidden='true'>
                  📝
                </span>
                <span>{translations[language].surveyCta}</span>
              </button>
              <a href='/referral' className='btn btn-secondary'>
                <span className='btn-icon' aria-hidden='true'>
                  🤝
                </span>
                <span>{translations[language].referralCta}</span>
              </a>
            </div>
          </GlassCard>

          {/* Booking Card */}
          <GlassCard className='action-card'>
            <h3>{translations[language].bookTitle}</h3>
            <p>{translations[language].bookDesc}</p>
            <div className='button-row'>
              <a
                href={process.env.PAY_BOOKING_LINK || '#'}
                target='_blank'
                rel='noopener noreferrer'
                className='btn btn-primary'
              >
                <span className='btn-icon' aria-hidden='true'>
                  📅
                </span>
                <span>{translations[language].bookCta}</span>
              </a>
              <button
                onClick={() => setIsModalOpen(true)}
                className='btn btn-secondary'
              >
                <span className='btn-icon' aria-hidden='true'>
                  💬
                </span>
                <span>
                  {translations[language].contactCta || 'Contact First'}
                </span>
              </button>
            </div>
          </GlassCard>
        </div>

        <div className='footer-container' />
      </main>

      <ContactModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        translations={translations[language]}
      />
    </div>
  );
}

export default App;
