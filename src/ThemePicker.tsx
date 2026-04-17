import { useState, useEffect } from 'react';

const THEMES = [
  { id: 'mocha', label: 'Mocha', color: '#cba6f7' },
  { id: 'tokyo', label: 'Tokyo Night', color: '#bb9af7' },
  { id: 'dracula', label: 'Dracula', color: '#bd93f9' },
  { id: 'nord', label: 'Nord', color: '#88c0d0' },
];

export function ThemePicker() {
  const [current, setCurrent] = useState(
    () => localStorage.getItem('site-theme') || 'mocha'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', current);
    localStorage.setItem('site-theme', current);
  }, [current]);

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {THEMES.map((t) => (
        <button
          key={t.id}
          title={t.label}
          onClick={() => setCurrent(t.id)}
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: t.color,
            border: current === t.id ? '3px solid var(--text)' : '2px solid var(--border)',
            cursor: 'pointer',
            padding: 0,
            transition: 'transform 0.1s',
            transform: current === t.id ? 'scale(1.2)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  );
}
