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
  const [carouselCollapsed, setCarouselCollapsed] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLElement>(null);

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

  const isMobile = () => window.innerWidth < 640;

  const loadTemplate = useCallback((tmpl: Template) => {
    setSelected(tmpl);
    pushRecent(tmpl.id);
    setTopPos({ x: 0.5, y: 0.05 });
    setBottomPos({ x: 0.5, y: 0.95 });

    // Auto-collapse carousel on mobile after selecting a template
    if (isMobile()) {
      setCarouselCollapsed(true);
    }

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
        {/* Search bar - sticky on mobile, hidden when collapsed */}
        <div className={`search-bar-wrapper${carouselCollapsed ? ' search-bar-hidden' : ''}`} style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border)' }}>
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 16, // 16px prevents iOS zoom on focus
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Desktop grid */}
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

        {/* Mobile carousel */}
        <div className="template-carousel-wrap" style={{ display: 'none', flexDirection: 'column' }}>
          {/* Collapsed bar: shown on mobile when a template is selected and carousel is collapsed */}
          {carouselCollapsed && selected && (
            <div
              className="carousel-collapsed-bar"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '0 12px',
                height: 48,
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface)',
                flexShrink: 0,
              }}
            >
              <img
                src={selected.url}
                alt={selected.name}
                style={{
                  width: 40,
                  height: 30,
                  objectFit: 'cover',
                  borderRadius: 4,
                  flexShrink: 0,
                  border: '1px solid var(--border)',
                }}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {selected.name}
              </span>
              <button
                onClick={() => setCarouselCollapsed(false)}
                style={{
                  flexShrink: 0,
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--accent)',
                  color: 'var(--bg)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Change
              </button>
            </div>
          )}

          {/* Full carousel: hidden when collapsed */}
          {!carouselCollapsed && (
            <div
              className="template-carousel"
              style={{
                display: 'flex',
                flexDirection: 'row',
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
                scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'],
                gap: 12,
                padding: '10px 7.5vw',
              }}
            >
              {/* Upload card */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="carousel-card"
                style={{
                  flexShrink: 0,
                  width: '85vw',
                  scrollSnapAlign: 'center',
                  background: 'var(--bg)',
                  border: '2px dashed var(--border)',
                  borderRadius: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 200,
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 36, color: 'var(--text-muted)' }}>+</span>
                <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>Upload your own image</span>
              </div>

              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="carousel-card"
                      style={{
                        flexShrink: 0,
                        width: '85vw',
                        scrollSnapAlign: 'center',
                        background: 'var(--surface2)',
                        borderRadius: 12,
                        height: 230,
                        animation: 'pulse 1.5s ease-in-out infinite',
                      }}
                    />
                  ))
                : displayList.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      className="carousel-card"
                      onClick={() => loadTemplate(tmpl)}
                      style={{
                        flexShrink: 0,
                        width: '85vw',
                        scrollSnapAlign: 'center',
                        background: 'var(--surface)',
                        border: selected?.id === tmpl.id ? '2px solid var(--accent)' : '2px solid var(--border)',
                        borderRadius: 12,
                        cursor: 'pointer',
                        overflow: 'hidden',
                        position: 'relative',
                        transition: 'border-color 0.15s',
                      }}
                    >
                      <img
                        src={tmpl.url}
                        alt={tmpl.name}
                        loading="lazy"
                        style={{
                          width: '100%',
                          height: 200,
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                      {selected?.id === tmpl.id && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: 'var(--accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 16,
                            color: 'var(--bg)',
                            fontWeight: 700,
                          }}
                        >
                          ✓
                        </div>
                      )}
                      <div
                        style={{
                          padding: '8px 10px',
                          fontSize: 13,
                          fontWeight: selected?.id === tmpl.id ? 600 : 400,
                          color: selected?.id === tmpl.id ? 'var(--accent)' : 'var(--text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {tmpl.name}
                      </div>
                    </div>
                  ))}
            </div>
          )}
        </div>

        {!loading && (
          <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            {displayList.length} templates
          </div>
        )}
      </aside>

      {/* Editor Area */}
      <main ref={editorRef} className="meme-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
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
              padding: 20,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 64 }}>🎭</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>Pick a template to get started</div>
            <div style={{ fontSize: 14 }}>Choose from the list above, or upload your own image.</div>
          </div>
        ) : (
          <div className="editor-split" style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
            {/* Canvas */}
            <div
              ref={containerRef}
              className={`canvas-wrapper${controlsVisible ? ' canvas-split' : ' canvas-full'}`}
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

            {/* Mobile toggle bar */}
            <div className="mobile-toggle-bar">
              {controlsVisible ? (
                <button
                  className="toggle-pill"
                  onClick={() => setControlsVisible(false)}
                >
                  Hide controls
                </button>
              ) : (
                <>
                  <button
                    className="toggle-pill"
                    onClick={() => setControlsVisible(true)}
                  >
                    Edit text
                  </button>
                  <button
                    onClick={handleDownload}
                    className="toggle-download-btn"
                  >
                    Download
                  </button>
                </>
              )}
            </div>

            {/* Controls */}
            <div
              className={`controls-panel${controlsVisible ? '' : ' controls-hidden'}`}
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
                  className="font-slider"
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
              <div className="download-wrapper" style={{ flex: '0 0 auto', marginLeft: 'auto' }}>
                <button
                  onClick={handleDownload}
                  className="download-btn"
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

        /* Mobile: < 640px */
        @media (max-width: 639px) {
          .meme-layout {
            flex-direction: column !important;
            width: 100% !important;
            max-width: 100vw !important;
            overflow-x: hidden !important;
          }

          /* Template panel: full-width, auto height for carousel */
          .template-panel {
            width: 100vw !important;
            max-width: 100% !important;
            min-width: 0 !important;
            border-right: none !important;
            border-bottom: 1px solid var(--border) !important;
            flex-shrink: 0 !important;
            box-sizing: border-box !important;
          }

          /* Search bar above carousel */
          .search-bar-wrapper {
            padding: 10px 12px 8px !important;
          }

          /* Hide desktop grid, show mobile carousel */
          .template-grid {
            display: none !important;
          }
          .template-carousel-wrap {
            display: flex !important;
          }

          /* Hide search bar when carousel is collapsed */
          .search-bar-hidden {
            display: none !important;
          }

          /* Collapsed bar visible on mobile only */
          .carousel-collapsed-bar {
            display: flex !important;
          }

          /* Hide scrollbar in carousel */
          .template-carousel::-webkit-scrollbar {
            display: none !important;
          }

          /* Card active press feedback */
          .carousel-card:active {
            opacity: 0.85 !important;
          }

          /* Editor area below templates */
          .meme-main {
            min-height: 0;
            flex: 1 1 0 !important;
            overflow: hidden !important;
          }

          /* Editor split container fills available height */
          .editor-split {
            height: 100% !important;
            overflow: hidden !important;
          }

          /* Canvas: split mode ~50% */
          .canvas-wrapper.canvas-split {
            flex: 0 0 50% !important;
            max-height: 50% !important;
            padding: 12px !important;
            overflow: hidden !important;
          }
          .canvas-wrapper.canvas-split canvas {
            max-width: 100% !important;
            max-height: 100% !important;
            width: auto !important;
          }

          /* Canvas: full/preview mode */
          .canvas-wrapper.canvas-full {
            flex: 1 !important;
            max-height: none !important;
            padding: 12px !important;
            overflow: hidden !important;
          }
          .canvas-wrapper.canvas-full canvas {
            max-width: 100% !important;
            max-height: 100% !important;
            width: auto !important;
          }

          /* Controls: scrollable bottom half */
          .controls-panel {
            flex: 1 !important;
            overflow-y: auto !important;
            padding: 12px !important;
            gap: 12px !important;
          }
          .controls-panel.controls-hidden {
            display: none !important;
          }
          .controls-panel > div {
            flex: 1 1 100% !important;
            min-width: unset !important;
          }

          /* Mobile toggle bar */
          .mobile-toggle-bar {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 10px !important;
            height: 36px !important;
            flex-shrink: 0 !important;
            background: var(--surface) !important;
            border-top: 1px solid var(--border) !important;
            border-bottom: 1px solid var(--border) !important;
          }
          .toggle-pill {
            padding: 4px 18px !important;
            border-radius: 20px !important;
            border: 1px solid var(--border) !important;
            background: var(--bg) !important;
            color: var(--text) !important;
            font-size: 13px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: background 0.15s !important;
          }
          .toggle-pill:active {
            background: var(--surface2) !important;
          }
          .toggle-download-btn {
            padding: 4px 16px !important;
            border-radius: 20px !important;
            border: none !important;
            background: var(--accent) !important;
            color: var(--bg) !important;
            font-size: 13px !important;
            font-weight: 700 !important;
            cursor: pointer !important;
            transition: opacity 0.15s !important;
          }
          .toggle-download-btn:active {
            opacity: 0.8 !important;
          }

          /* Download button full-width */
          .download-wrapper {
            flex: 1 1 100% !important;
            margin-left: 0 !important;
          }
          .download-btn {
            width: 100% !important;
            padding: 14px !important;
            font-size: 17px !important;
          }

          /* Font slider: larger thumb for touch */
          .font-slider {
            height: 24px !important;
            cursor: pointer !important;
          }
          .font-slider::-webkit-slider-thumb {
            width: 28px !important;
            height: 28px !important;
          }
          .font-slider::-moz-range-thumb {
            width: 28px !important;
            height: 28px !important;
          }
        }

        /* Desktop: >= 640px */
        @media (min-width: 640px) {
          .template-carousel-wrap {
            display: none !important;
          }
          .template-grid {
            display: grid !important;
          }
          .carousel-collapsed-bar {
            display: none !important;
          }
          .search-bar-hidden {
            display: block !important;
          }
          .mobile-toggle-bar {
            display: none !important;
          }
          .controls-panel.controls-hidden {
            display: flex !important;
          }
          .canvas-wrapper.canvas-split,
          .canvas-wrapper.canvas-full {
            flex: 1 !important;
            max-height: none !important;
          }
          .canvas-wrapper canvas {
            max-height: calc(100vh - 280px) !important;
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
