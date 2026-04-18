import { useState, useEffect } from 'react';

const THEMES = [
  { id: 'tokyo', label: 'Tokyo Night', color: '#73daca' },
  { id: 'miami', label: 'Miami', color: '#ff2d95' },
  { id: 'matcha', label: 'Matcha', color: '#8db660' },
  { id: 'gruvbox', label: 'Gruvbox', color: '#fb4934' },
] as const;

type ThemeId = (typeof THEMES)[number]['id'];

const STORAGE_KEY = 'site-theme';

export function ThemePicker() {
  const [active, setActive] = useState<ThemeId>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    if (stored && THEMES.some((t) => t.id === stored)) return stored;
    return 'tokyo';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', active);
    localStorage.setItem(STORAGE_KEY, active);
  }, [active]);

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {THEMES.map((t) => (
        <button
          key={t.id}
          title={t.label}
          aria-label={`Switch to ${t.label} theme`}
          onClick={() => setActive(t.id)}
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: t.color,
            border: active === t.id ? '3px solid var(--text)' : '2px solid var(--border)',
            cursor: 'pointer',
            padding: 0,
            transition: 'transform 0.1s',
            transform: active === t.id ? 'scale(1.2)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  );
}
