import { motion, useMotionValue } from 'framer-motion';
import { useState, useEffect } from 'react';

export default function Sticker({
  src,
  link,
  initialX,
  initialY,
  scale = 1,
  rotation = 0,
  parallaxFactor = 1000,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Parallax effect based on mouse (desktop) and device orientation (mobile)
  useEffect(() => {
    if (!parallaxFactor || parallaxFactor <= 0) {
      x.set(0);
      y.set(0);
      return;
    }

    const updatePosition = (moveX, moveY) => {
      x.set(moveX);
      y.set(moveY);
    };

    const handleMouseMove = (e) => {
      const { innerWidth, innerHeight } = window;
      const moveX = (e.clientX - innerWidth / 2) / parallaxFactor;
      const moveY = (e.clientY - innerHeight / 2) / parallaxFactor;
      updatePosition(moveX, moveY);
    };

    let orientationAttached = false;
    const handleOrientation = (event) => {
      const gamma = Number.isFinite(event.gamma) ? event.gamma : 0; // left-right tilt
      const beta = Number.isFinite(event.beta) ? event.beta : 0; // front-back tilt
      const clampedGamma = Math.max(-45, Math.min(45, gamma));
      const clampedBeta = Math.max(-45, Math.min(45, beta));
      const moveX =
        (clampedGamma / 45) * (window.innerWidth / 2 / parallaxFactor);
      const moveY =
        (clampedBeta / 45) * (window.innerHeight / 2 / parallaxFactor);
      updatePosition(moveX, moveY);
    };

    const enableOrientation = async () => {
      if (typeof window === 'undefined') return;
      const DeviceOrientation = window.DeviceOrientationEvent;
      if (!DeviceOrientation) return;

      if (typeof DeviceOrientation.requestPermission === 'function') {
        try {
          const permission = await DeviceOrientation.requestPermission();
          if (permission !== 'granted') return;
        } catch (_err) {
          return;
        }
      }

      window.addEventListener('deviceorientation', handleOrientation);
      orientationAttached = true;
    };

    enableOrientation();
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (orientationAttached) {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, [x, y, parallaxFactor]);

  const handleClick = () => {
    if (link) {
      window.open(link, '_blank');
    }
  };

  return (
    <motion.div
      style={{
        position: 'absolute',
        left: initialX,
        top: initialY,
        x,
        y,
        scale,
        rotate: rotation,
        cursor: link ? 'pointer' : 'default',
        zIndex: isHovered ? 10 : 1,
      }}
      whileHover={{ scale: scale * 1.2, rotate: rotation + 5 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={handleClick}
    >
      <img
        src={src}
        alt='Sticker'
        style={{
          width: '150px', // Adjust size as needed
          height: 'auto',
          filter: 'drop-shadow(0px 10px 10px rgba(0,0,0,0.2))',
          pointerEvents: 'none', // Let click pass through to motion.div
        }}
      />
    </motion.div>
  );
}
