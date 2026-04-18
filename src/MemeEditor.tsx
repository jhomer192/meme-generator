import { useRef, useEffect, useState, useCallback } from 'react';

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface Template {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
}

interface TextBox {
  id: string;
  text: string;
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
  fontSize: number; // px at canvas resolution
  color: string;
  outline: boolean;
}

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

function makeDefaultBoxes(): TextBox[] {
  return [
    { id: uid(), text: '', x: 0.5, y: 0.08, fontSize: 48, color: '#ffffff', outline: true },
    { id: uid(), text: '', x: 0.5, y: 0.92, fontSize: 48, color: '#ffffff', outline: true },
  ];
}

function drawTextBoxes(
  ctx: CanvasRenderingContext2D,
  boxes: TextBox[],
  canvasWidth: number,
  canvasHeight: number
) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const box of boxes) {
    if (!box.text.trim()) continue;
    const scaledFont = Math.round(box.fontSize * (canvasWidth / 500));
    ctx.font = `900 ${scaledFont}px Impact, "Arial Black", sans-serif`;
    const text = box.text.toUpperCase();
    const x = box.x * canvasWidth;
    const y = box.y * canvasHeight;

    if (box.outline) {
      ctx.strokeStyle = 'black';
      ctx.lineWidth = scaledFont / 8;
      ctx.lineJoin = 'round';
      ctx.strokeText(text, x, y, canvasWidth - 20);
      ctx.fillStyle = box.color;
    } else {
      ctx.fillStyle = box.color;
    }
    ctx.fillText(text, x, y, canvasWidth - 20);
  }
}

function drawMeme(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  boxes: TextBox[]
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  drawTextBoxes(ctx, boxes, canvas.width, canvas.height);
}

export function MemeEditor() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Template | null>(null);
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);
  const [canvasDims, setCanvasDims] = useState<{ w: number; h: number } | null>(null);
  const [textBoxes, setTextBoxes] = useState<TextBox[]>(makeDefaultBoxes());
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  const [carouselCollapsed, setCarouselCollapsed] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLElement>(null);

  // drag state - stored in refs to avoid stale closures
  const dragBoxId = useRef<string | null>(null);
  const dragOffsetRef = useRef({ dx: 0, dy: 0 });

  const recent = getRecent();

  useEffect(() => {
    fetch('https://api.imgflip.com/get_memes')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setTemplates(data.data.memes);
      })
      .finally(() => setLoading(false));
  }, []);

  // Apply canvas dimensions whenever the image or dims change.
  // This runs after React has committed the canvas to the DOM (which only
  // happens after `selected` is set), so canvasRef.current is guaranteed
  // to be non-null here — unlike inside an onload callback.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasDims) return;
    canvas.width = canvasDims.w;
    canvas.height = canvasDims.h;
  }, [canvasDims]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImg) return;
    drawMeme(canvas, loadedImg, textBoxes);
  // canvasDims in deps ensures redraw runs after dimensions are applied
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedImg, textBoxes, canvasDims]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const isMobile = () => window.innerWidth < 640;

  const loadTemplate = useCallback((tmpl: Template) => {
    setSelected(tmpl);
    pushRecent(tmpl.id);
    setTextBoxes(makeDefaultBoxes());
    setLoadedImg(null); // clear stale image while new one loads

    if (isMobile()) {
      setCarouselCollapsed(true);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Don't touch canvasRef here — the canvas may not be in the DOM yet
      // (it only renders after `selected` state causes a re-render).
      // Store dims in state; a useEffect will apply them once the canvas mounts.
      setCanvasDims({ w: tmpl.width, h: tmpl.height });
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
      setCanvasDims({ w: img.naturalWidth, h: img.naturalHeight });
      setTextBoxes(makeDefaultBoxes());
      setLoadedImg(img);
    };
    img.src = url;
  };

  const handleDownload = () => {
    if (!loadedImg || !selected) return;
    const offscreen = document.createElement('canvas');
    offscreen.width = selected.width;
    offscreen.height = selected.height;
    drawMeme(offscreen, loadedImg, textBoxes);
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

  // Convert screen coords to normalized canvas coords
  const screenToCanvas = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  };

  // Hit test: find box within ~40px radius (in screen space)
  const hitTest = (clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImg) return null;
    const rect = canvas.getBoundingClientRect();
    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;
    const threshold = 40 / rect.width; // 40px converted to normalized

    // Test in reverse order (last = top-most rendered)
    for (let i = textBoxes.length - 1; i >= 0; i--) {
      const box = textBoxes[i];
      const dx = Math.abs(nx - box.x);
      const dy = Math.abs(ny - box.y);
      if (dx < threshold * 3 && dy < threshold) {
        return box.id;
      }
    }
    return null;
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const hitId = hitTest(e.clientX, e.clientY);
    if (hitId) {
      dragBoxId.current = hitId;
      setActiveBoxId(hitId);
      const pos = screenToCanvas(e.clientX, e.clientY);
      const box = textBoxes.find((b) => b.id === hitId);
      if (pos && box) {
        dragOffsetRef.current = { dx: pos.x - box.x, dy: pos.y - box.y };
      }
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragBoxId.current) return;
    const pos = screenToCanvas(e.clientX, e.clientY);
    if (!pos) return;
    const newX = Math.max(0, Math.min(1, pos.x - dragOffsetRef.current.dx));
    const newY = Math.max(0, Math.min(1, pos.y - dragOffsetRef.current.dy));
    setTextBoxes((prev) =>
      prev.map((b) => (b.id === dragBoxId.current ? { ...b, x: newX, y: newY } : b))
    );
  };

  const handleMouseUp = () => {
    dragBoxId.current = null;
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = e.touches[0];
    const hitId = hitTest(touch.clientX, touch.clientY);
    if (hitId) {
      dragBoxId.current = hitId;
      setActiveBoxId(hitId);
      const pos = screenToCanvas(touch.clientX, touch.clientY);
      const box = textBoxes.find((b) => b.id === hitId);
      if (pos && box) {
        dragOffsetRef.current = { dx: pos.x - box.x, dy: pos.y - box.y };
      }
      e.preventDefault(); // prevent scroll only when hitting a box
    }
    // no preventDefault if miss - allows page scroll
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!dragBoxId.current) return;
    const touch = e.touches[0];
    const pos = screenToCanvas(touch.clientX, touch.clientY);
    if (!pos) return;
    const newX = Math.max(0, Math.min(1, pos.x - dragOffsetRef.current.dx));
    const newY = Math.max(0, Math.min(1, pos.y - dragOffsetRef.current.dy));
    setTextBoxes((prev) =>
      prev.map((b) => (b.id === dragBoxId.current ? { ...b, x: newX, y: newY } : b))
    );
    e.preventDefault();
  };

  const handleTouchEnd = () => {
    dragBoxId.current = null;
  };

  const updateBox = (id: string, patch: Partial<TextBox>) => {
    setTextBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const addBox = () => {
    const newBox: TextBox = {
      id: uid(),
      text: '',
      x: 0.5,
      y: 0.5,
      fontSize: 48,
      color: '#ffffff',
      outline: true,
    };
    setTextBoxes((prev) => [...prev, newBox]);
    setActiveBoxId(newBox.id);
  };

  const deleteBox = (id: string) => {
    if (textBoxes.length <= 1) return;
    setTextBoxes((prev) => prev.filter((b) => b.id !== id));
    if (activeBoxId === id) {
      const remaining = textBoxes.filter((b) => b.id !== id);
      setActiveBoxId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
    }
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

  // Shared text box card renderer (used in both desktop right panel and mobile)
  const renderTextBoxCards = () =>
    textBoxes.map((box, idx) => (
      <div
        key={box.id}
        onClick={() => setActiveBoxId(box.id)}
        style={{
          border: activeBoxId === box.id ? '2px solid var(--accent)' : '2px solid var(--border)',
          borderRadius: 10,
          padding: '10px 12px',
          background: 'var(--bg)',
          cursor: 'pointer',
          transition: 'border-color 0.15s',
          flexShrink: 0,
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', flex: 1 }}>
            Text {idx + 1}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); deleteBox(box.id); }}
            disabled={textBoxes.length <= 1}
            title="Remove text box"
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              border: 'none',
              background: textBoxes.length <= 1 ? 'var(--surface2)' : '#e55',
              color: textBoxes.length <= 1 ? 'var(--text-muted)' : '#fff',
              cursor: textBoxes.length <= 1 ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            x
          </button>
        </div>

        {/* Text input */}
        <input
          type="text"
          value={box.text}
          onChange={(e) => updateBox(box.id, { text: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          placeholder="Enter text..."
          style={{ ...inputStyle, marginBottom: 8, fontSize: 15 }}
        />

        {/* Controls row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 120px', minWidth: 100 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Size</label>
            <input
              type="range"
              min={16}
              max={96}
              value={box.fontSize}
              onChange={(e) => updateBox(box.id, { fontSize: Number(e.target.value) })}
              onClick={(e) => e.stopPropagation()}
              className="font-slider"
              style={{ flex: 1, accentColor: 'var(--accent)' }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 26, textAlign: 'right' }}>
              {box.fontSize}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Color</label>
            <input
              type="color"
              value={box.color}
              onChange={(e) => updateBox(box.id, { color: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              title="Text color"
              style={{
                width: 30,
                height: 30,
                cursor: 'pointer',
                borderRadius: 6,
                border: '1px solid var(--border)',
                padding: 2,
                background: 'var(--bg)',
              }}
            />
          </div>

          <div
            style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); updateBox(box.id, { outline: !box.outline }); }}
          >
            <div
              style={{
                width: 32,
                height: 18,
                borderRadius: 9,
                background: box.outline ? 'var(--accent)' : 'var(--surface2)',
                position: 'relative',
                transition: 'background 0.15s',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 2,
                  left: box.outline ? 14 : 2,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.15s',
                }}
              />
            </div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
              Outline
            </label>
          </div>
        </div>
      </div>
    ));

  const addTextButton = (
    <button
      onClick={addBox}
      style={{
        padding: '8px 0',
        borderRadius: 8,
        border: '2px dashed var(--border)',
        background: 'transparent',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        transition: 'border-color 0.15s, color 0.15s',
        width: '100%',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.color = 'var(--accent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.color = 'var(--text-muted)';
      }}
    >
      + Add text
    </button>
  );

  const downloadButton = (
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
        width: '100%',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
    >
      Download
    </button>
  );

  const canvasEl = (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        maxWidth: '100%',
        maxHeight: '100%',
        objectFit: 'contain',
        borderRadius: 8,
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        cursor: 'crosshair',
        display: 'block',
        touchAction: 'pan-y',
      }}
    />
  );

  return (
    <>
      {/* ===================== DESKTOP layout (>= 640px) ===================== */}
      <div className="meme-layout-desktop">
        {/* LEFT: Template sidebar — 280px, scrollable */}
        <aside className="sidebar-left">
          {/* Search — sticky at top */}
          <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
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
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Template grid — scrollable */}
          <div
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
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />

            {loading
              ? Array.from({ length: 11 }).map((_, i) => (
                  <div key={i} style={{ background: 'var(--surface2)', borderRadius: 8, minHeight: 70, animation: 'pulse 1.5s ease-in-out infinite' }} />
                ))
              : displayList.map((tmpl) => (
                  <div key={tmpl.id} style={cardStyle(tmpl)} onClick={() => loadTemplate(tmpl)} title={tmpl.name}>
                    <img src={tmpl.url} alt={tmpl.name} loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                    <div style={{ fontSize: 10, padding: '3px 4px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {recent.includes(tmpl.id) && !search && <span style={{ color: 'var(--accent)', marginRight: 3 }}>*</span>}
                      {tmpl.name}
                    </div>
                  </div>
                ))}
          </div>

          {!loading && (
            <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              {displayList.length} templates
            </div>
          )}
        </aside>

        {/* CENTER: Canvas — flex 1, fills remaining space */}
        <main ref={editorRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', background: 'var(--bg)' }}>
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 12, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 64 }}>🎭</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>Pick a template to get started</div>
              <div style={{ fontSize: 14 }}>Choose from the list on the left, or upload your own image.</div>
            </div>
          ) : (
            <>
              {/* Canvas fills all available vertical space */}
              <div
                ref={containerRef}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, minHeight: 0, overflow: 'hidden' }}
              >
                {canvasEl}
              </div>
              {/* Download — always visible below canvas, not scrollable */}
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                {downloadButton}
              </div>
            </>
          )}
        </main>

        {/* RIGHT: Text controls — 300px, scrollable cards, sticky add button */}
        {selected && (
          <aside className="sidebar-right">
            {/* Scrollable text box cards */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {renderTextBoxCards()}
            </div>
            {/* Sticky Add text button at bottom */}
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              {addTextButton}
            </div>
          </aside>
        )}
      </div>

      {/* ===================== MOBILE layout (< 640px) ===================== */}
      <div className="meme-layout-mobile">
        {/* 1. Template picker — collapsible carousel */}
        <div style={{ flexShrink: 0, background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          {carouselCollapsed && selected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', height: 48 }}>
              <img src={selected.url} alt={selected.name} style={{ width: 40, height: 30, objectFit: 'cover', borderRadius: 4, flexShrink: 0, border: '1px solid var(--border)' }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selected.name}
              </span>
              <button
                onClick={() => setCarouselCollapsed(false)}
                style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'var(--bg)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <div style={{ padding: '10px 12px 8px' }}>
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  overflowX: 'auto',
                  scrollSnapType: 'x mandatory',
                  WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
                  scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'],
                  gap: 12,
                  padding: '8px 7.5vw 10px',
                }}
              >
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{ flexShrink: 0, width: '85vw', scrollSnapAlign: 'center', background: 'var(--bg)', border: '2px dashed var(--border)', borderRadius: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, gap: 8 }}
                >
                  <span style={{ fontSize: 36, color: 'var(--text-muted)' }}>+</span>
                  <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>Upload your own image</span>
                </div>
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} style={{ flexShrink: 0, width: '85vw', scrollSnapAlign: 'center', background: 'var(--surface2)', borderRadius: 12, height: 190, animation: 'pulse 1.5s ease-in-out infinite' }} />
                    ))
                  : displayList.map((tmpl) => (
                      <div
                        key={tmpl.id}
                        onClick={() => loadTemplate(tmpl)}
                        style={{ flexShrink: 0, width: '85vw', scrollSnapAlign: 'center', background: 'var(--surface)', border: selected?.id === tmpl.id ? '2px solid var(--accent)' : '2px solid var(--border)', borderRadius: 12, cursor: 'pointer', overflow: 'hidden', position: 'relative', transition: 'border-color 0.15s' }}
                      >
                        <img src={tmpl.url} alt={tmpl.name} loading="lazy" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
                        {selected?.id === tmpl.id && (
                          <div style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--bg)', fontWeight: 700 }}>✓</div>
                        )}
                        <div style={{ padding: '6px 10px', fontSize: 12, fontWeight: selected?.id === tmpl.id ? 600 : 400, color: selected?.id === tmpl.id ? 'var(--accent)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {tmpl.name}
                        </div>
                      </div>
                    ))}
              </div>
            </>
          )}
        </div>

        {/* 2. Canvas — max ~50vh */}
        {selected ? (
          <div ref={containerRef} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, maxHeight: '50vh', overflow: 'hidden', background: 'var(--bg)' }}>
            {canvasEl}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 12, padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 48 }}>🎭</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Pick a template to get started</div>
          </div>
        )}

        {/* 3. Text controls — scrollable, max ~40vh */}
        {selected && (
          <div style={{ flexShrink: 0, maxHeight: '40vh', overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
            {renderTextBoxCards()}
            {addTextButton}
          </div>
        )}

        {/* 4. Download — always visible, not inside scroll */}
        {selected && (
          <div style={{ flexShrink: 0, padding: '10px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
            {downloadButton}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        /* Desktop layout */
        .meme-layout-desktop {
          display: none;
        }
        .meme-layout-mobile {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
        }

        @media (min-width: 640px) {
          .meme-layout-desktop {
            display: flex;
            flex-direction: row;
            flex: 1;
            overflow: hidden;
            min-height: 0;
          }
          .meme-layout-mobile {
            display: none;
          }
          .sidebar-left {
            width: 280px;
            flex-shrink: 0;
            background: var(--surface);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .sidebar-right {
            width: 300px;
            flex-shrink: 0;
            background: var(--surface);
            border-left: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
        }

        .font-slider {
          cursor: pointer;
        }
        @media (max-width: 639px) {
          .font-slider {
            height: 24px;
          }
          .font-slider::-webkit-slider-thumb {
            width: 28px;
            height: 28px;
          }
          .font-slider::-moz-range-thumb {
            width: 28px;
            height: 28px;
          }
        }
      `}</style>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'system-ui, sans-serif',
  boxSizing: 'border-box',
};
