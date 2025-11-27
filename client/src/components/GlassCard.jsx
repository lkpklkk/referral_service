import { motion } from 'framer-motion';

export default function GlassCard({ children, className = '' }) {
  return (
        <motion.div
            className={`glass-card ${className}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{
                background: 'rgba(255, 255, 255, 0.18)',
                backdropFilter: 'blur(6px)',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 18px 40px rgba(0, 0, 0, 0.18)',
                color: '#fff',
            }}
        >
            {children}
        </motion.div>
  );
}
