import { useRef, useEffect, useState, useCallback } from 'react';

interface Template {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
}

interface TextBlock {
  text: string;
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
}

type PositionMode = 'classic' | 'custom';

const RECENT_KEY = 'meme-recent-ids';

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function pushRecent(id: string) {
  const recent = getRecent().filter((r) => r !== id);
  recent.unshift(id);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 5)));
}

function drawMeme(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  top: TextBlock,
  bottom: TextBlock,
  fontSize: number,
  color: string,
  outline: boolean,
  posMode: PositionMode
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const scaledFont = Math.round(fontSize * (canvas.width / 500));
  ctx.font = `900 ${scaledFont}px Impact, "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  function drawText(block: TextBlock, defaultY: number, baseline: CanvasTextBaseline) {
    if (!block.text.trim()) return;
    ctx!.textBaseline = baseline;
    const text = block.text.toUpperCase();
    const x = posMode === 'custom' ? block.x * canvas.width : canvas.width / 2;
    const y = posMode === 'custom' ? block.y * canvas.height : defaultY;

    if (outline) {
      ctx!.strokeStyle = 'black';
      ctx!.lineWidth = scaledFont * 0.12;
      ctx!.lineJoin = 'round';
      ctx!.strokeText(text, x, y, canvas.width - 20);
    }
    ctx!.fillStyle = color;
    ctx!.fillText(text, x, y, canvas.width - 20);
  }

  const margin = Math.round(scaledFont * 0.3);
  drawText(top, margin, 'top');
  ctx.textBaseline = 'bottom';
  drawText(bottom, canvas.height - margin, 'bottom');
}

export function MemeEditor() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Template | null>(null);
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);
  const [topText, setTopText] = useState('');
  const [bottomText, setBottomText] = useState('');
  const [fontSize, setFontSize] = useState(48);
  const [color, setColor] = useState('#ffffff');
  const [outline, setOutline] = useState(true);
  const [posMode, setPosMode] = useState<PositionMode>('classic');
  const [topPos, setTopPos] = useState({ x: 0.5, y: 0.05 });
  const [bottomPos, setBottomPos] = useState({ x: 0.5, y: 0.95 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // drag state
  const dragTarget = useRef<'top' | 'bottom' | null>(null);

  const recent = getRecent();

  useEffect(() => {
    fetch('https://api.imgflip.com/get_memes')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setTemplates(data.data.memes);
      })
      .finally(() => setLoading(false));
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImg) return;
    drawMeme(
      canvas,
      loadedImg,
      { text: topText, ...topPos },
      { text: bottomText, ...bottomPos },
      fontSize,
      color,
      outline,
      posMode
    );
  }, [loadedImg, topText, bottomText, fontSize, color, outline, posMode, topPos, bottomPos]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const loadTemplate = useCallback((tmpl: Template) => {
    setSelected(tmpl);
    pushRecent(tmpl.id);
    setTopPos({ x: 0.5, y: 0.05 });
    setBottomPos({ x: 0.5, y: 0.95 });

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = tmpl.width;
        canvas.height = tmpl.height;
      }
      setLoadedImg(img);
    };
    img.src = tmpl.url;
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const fakeTmpl: Template = {
        id: 'custom',
        name: file.name,
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
      setSelected(fakeTmpl);
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
      }
      setTopPos({ x: 0.5, y: 0.05 });
      setBottomPos({ x: 0.5, y: 0.95 });
      setLoadedImg(img);
    };
    img.src = url;
  };

  const handleDownload = () => {
    if (!loadedImg || !selected) return;
    const offscreen = document.createElement('canvas');
    offscreen.width = selected.width;
    offscreen.height = selected.height;
    drawMeme(
      offscreen,
      loadedImg,
      { text: topText, ...topPos },
      { text: bottomText, ...bottomPos },
      fontSize,
      color,
      outline,
      posMode
    );
    offscreen.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'meme.png';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const hitTest = (nx: number, ny: number): 'top' | 'bottom' | null => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImg) return null;
    const threshold = 0.12;
    if (topText && Math.abs(nx - topPos.x) < 0.4 && Math.abs(ny - topPos.y) < threshold) return 'top';
    if (bottomText && Math.abs(nx - bottomPos.x) < 0.4 && Math.abs(ny - bottomPos.y) < threshold) return 'bottom';
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (posMode !== 'custom') return;
    const { x, y } = getCanvasPos(e);
    dragTarget.current = hitTest(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (posMode !== 'custom' || !dragTarget.current) return;
    const { x, y } = getCanvasPos(e);
    if (dragTarget.current === 'top') setTopPos({ x, y });
    else setBottomPos({ x, y });
  };

  const handleMouseUp = () => {
    dragTarget.current = null;
  };

  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const recentTemplates = recent
    .map((id) => templates.find((t) => t.id === id))
    .filter(Boolean) as Template[];

  const displayList = search
    ? filtered
    : [
        ...recentTemplates,
        ...filtered.filter((t) => !recent.includes(t.id)),
      ];

  const cardStyle = (tmpl: Template): React.CSSProperties => ({
    background: 'var(--surface)',
    border: selected?.id === tmpl.id ? '2px solid var(--accent)' : '2px solid var(--border)',
    borderRadius: 8,
    cursor: 'pointer',
    overflow: 'hidden',
    transition: 'border-color 0.15s, transform 0.1s',
    transform: selected?.id === tmpl.id ? 'scale(1.03)' : 'scale(1)',
  });

  return (
    <div className="meme-layout" style={{ display: 'flex', flex: 1, gap: 0, minHeight: 0 }}>
      {/* Template Picker */}
      <aside
        style={{
          width: 280,
          minWidth: 220,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
        className="template-panel"
      >
        <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border)' }}>
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>

        <div
          className="template-grid"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 10,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 6,
            alignContent: 'start',
          }}
        >
          {/* Upload card */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: 'var(--bg)',
              border: '2px dashed var(--border)',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 70,
              gap: 4,
              fontSize: 11,
              color: 'var(--text-muted)',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <span style={{ fontSize: 22 }}>+</span>
            <span>Upload</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />

          {loading
            ? Array.from({ length: 11 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--surface2)',
                    borderRadius: 8,
                    minHeight: 70,
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
              ))
            : displayList.map((tmpl) => (
                <div
                  key={tmpl.id}
                  style={cardStyle(tmpl)}
                  onClick={() => loadTemplate(tmpl)}
                  title={tmpl.name}
                >
                  <img
                    src={tmpl.url}
                    alt={tmpl.name}
                    loading="lazy"
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                  <div
                    style={{
                      fontSize: 10,
                      padding: '3px 4px',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {recent.includes(tmpl.id) && !search && (
                      <span style={{ color: 'var(--accent)', marginRight: 3 }}>*</span>
                    )}
                    {tmpl.name}
                  </div>
                </div>
              ))}
        </div>
        {!loading && (
          <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
            {displayList.length} templates
          </div>
        )}
      </aside>

      {/* Editor Area */}
      <main className="meme-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
        {!selected ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 64 }}>🎭</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>Pick a template to get started</div>
            <div style={{ fontSize: 14 }}>Choose from the panel on the left, or upload your own image.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
            {/* Canvas */}
            <div
              ref={containerRef}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                minHeight: 0,
                background: 'var(--bg)',
              }}
            >
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{
                  maxWidth: '100%',
                  maxHeight: 'calc(100vh - 280px)',
                  objectFit: 'contain',
                  borderRadius: 8,
                  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                  cursor: posMode === 'custom' ? 'crosshair' : 'default',
                  display: 'block',
                }}
              />
            </div>

            {/* Controls */}
            <div
              style={{
                borderTop: '1px solid var(--border)',
                background: 'var(--surface)',
                padding: '14px 20px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 16,
                alignItems: 'flex-end',
              }}
            >
              {/* Top text */}
              <div style={{ flex: '1 1 160px', minWidth: 140 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Top text
                </label>
                <input
                  type="text"
                  value={topText}
                  onChange={(e) => setTopText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                  placeholder="Top text..."
                  style={inputStyle}
                />
              </div>

              {/* Bottom text */}
              <div style={{ flex: '1 1 160px', minWidth: 140 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Bottom text
                </label>
                <input
                  type="text"
                  value={bottomText}
                  onChange={(e) => setBottomText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                  placeholder="Bottom text..."
                  style={inputStyle}
                />
              </div>

              {/* Font size */}
              <div style={{ flex: '0 0 140px' }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Font size: {fontSize}px
                </label>
                <input
                  type="range"
                  min={20}
                  max={80}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </div>

              {/* Text color */}
              <div style={{ flex: '0 0 auto' }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Text color
                </label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{ width: 44, height: 34, cursor: 'pointer', borderRadius: 6, border: '1px solid var(--border)', padding: 2, background: 'var(--bg)' }}
                />
              </div>

              {/* Outline toggle */}
              <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="outline"
                  checked={outline}
                  onChange={(e) => setOutline(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                <label htmlFor="outline" style={{ fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
                  Outline
                </label>
              </div>

              {/* Position mode */}
              <div style={{ flex: '0 0 auto', display: 'flex', gap: 6 }}>
                {(['classic', 'custom'] as PositionMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPosMode(m)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: posMode === m ? 'var(--accent)' : 'var(--bg)',
                      color: posMode === m ? 'var(--bg)' : 'var(--text)',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: posMode === m ? 600 : 400,
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
              {posMode === 'custom' && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', flex: '1 1 100%', marginTop: -8 }}>
                  Drag text blocks on the canvas to reposition them.
                </div>
              )}

              {/* Download */}
              <div style={{ flex: '0 0 auto', marginLeft: 'auto' }}>
                <button
                  onClick={handleDownload}
                  style={{
                    padding: '8px 22px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'var(--accent)',
                    color: 'var(--bg)',
                    cursor: 'pointer',
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @media (max-width: 640px) {
          .meme-layout {
            flex-direction: column !important;
          }
          .template-panel {
            width: 100% !important;
            min-width: unset !important;
            border-right: none !important;
            border-bottom: 1px solid var(--border) !important;
            max-height: 260px;
            flex-shrink: 0 !important;
          }
          .template-panel .template-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .meme-main {
            min-height: 0;
            flex: 1 1 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'system-ui, sans-serif',
};
