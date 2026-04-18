import { describe, it, expect } from 'vitest';

// ── Pure utility functions (mirrored from MemeEditor) ────────────────────────

/**
 * Convert screen (client) coordinates to normalized canvas coordinates [0,1].
 * Mirrors the `screenToCanvas` function in MemeEditor.
 */
function screenToCanvas(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number }
): { x: number; y: number } {
  return {
    x: (clientX - rect.left) / rect.width,
    y: (clientY - rect.top) / rect.height,
  };
}

interface TextBox {
  id: string;
  text: string;
  x: number; // normalized [0,1]
  y: number; // normalized [0,1]
  fontSize: number;
  color: string;
  outline: boolean;
}

/**
 * Hit-test: find the topmost text box whose anchor is within ~40px of the
 * click point in screen space. Mirrors the `hitTest` function in MemeEditor.
 */
function hitTest(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  boxes: TextBox[]
): string | null {
  const nx = (clientX - rect.left) / rect.width;
  const ny = (clientY - rect.top) / rect.height;
  const threshold = 40 / rect.width;

  for (let i = boxes.length - 1; i >= 0; i--) {
    const box = boxes[i];
    const dx = Math.abs(nx - box.x);
    const dy = Math.abs(ny - box.y);
    if (dx < threshold * 3 && dy < threshold) {
      return box.id;
    }
  }
  return null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRect(left = 0, top = 0, width = 500, height = 400) {
  return { left, top, width, height };
}

function makeBox(overrides: Partial<TextBox> = {}): TextBox {
  return {
    id: 'box-1',
    text: 'TEST',
    x: 0.5,
    y: 0.5,
    fontSize: 48,
    color: '#ffffff',
    outline: true,
    ...overrides,
  };
}

// ── screenToCanvas tests ─────────────────────────────────────────────────────

describe('screenToCanvas', () => {
  it('maps canvas origin (top-left) to (0, 0)', () => {
    const rect = makeRect(100, 50, 500, 400);
    const result = screenToCanvas(100, 50, rect);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('maps canvas bottom-right to (1, 1)', () => {
    const rect = makeRect(100, 50, 500, 400);
    const result = screenToCanvas(600, 450, rect);
    expect(result.x).toBe(1);
    expect(result.y).toBe(1);
  });

  it('maps the center of the canvas to (0.5, 0.5)', () => {
    const rect = makeRect(0, 0, 400, 300);
    const result = screenToCanvas(200, 150, rect);
    expect(result.x).toBeCloseTo(0.5);
    expect(result.y).toBeCloseTo(0.5);
  });

  it('handles a click with non-zero canvas offset', () => {
    const rect = makeRect(20, 30, 600, 400);
    const result = screenToCanvas(320, 230, rect);
    expect(result.x).toBeCloseTo(0.5);
    expect(result.y).toBeCloseTo(0.5);
  });

  it('allows values > 1 for clicks outside the canvas', () => {
    const rect = makeRect(0, 0, 100, 100);
    const result = screenToCanvas(150, 150, rect);
    expect(result.x).toBe(1.5);
    expect(result.y).toBe(1.5);
  });

  it('allows negative values for clicks to the left/above the canvas', () => {
    const rect = makeRect(100, 100, 300, 200);
    const result = screenToCanvas(50, 50, rect);
    expect(result.x).toBeCloseTo(-50 / 300);
    expect(result.y).toBeCloseTo(-50 / 200);
  });
});

// ── hitTest tests ────────────────────────────────────────────────────────────

describe('hitTest', () => {
  it('returns box id when clicking directly on a text anchor', () => {
    const rect = makeRect(0, 0, 500, 400);
    // box at (0.5, 0.5) → screen (250, 200)
    const box = makeBox({ id: 'a', x: 0.5, y: 0.5 });
    expect(hitTest(250, 200, rect, [box])).toBe('a');
  });

  it('returns null when clicking far from any box', () => {
    const rect = makeRect(0, 0, 500, 400);
    const box = makeBox({ id: 'a', x: 0.5, y: 0.5 });
    // click at top-left corner, far from the box center
    expect(hitTest(0, 0, rect, [box])).toBeNull();
  });

  it('returns null for empty box array', () => {
    const rect = makeRect(0, 0, 500, 400);
    expect(hitTest(250, 200, rect, [])).toBeNull();
  });

  it('returns the topmost (last in array) box when two overlap', () => {
    const rect = makeRect(0, 0, 500, 400);
    const boxA = makeBox({ id: 'a', x: 0.5, y: 0.5 });
    const boxB = makeBox({ id: 'b', x: 0.5, y: 0.5 });
    // boxB is last → should be hit first
    expect(hitTest(250, 200, rect, [boxA, boxB])).toBe('b');
  });

  it('hits within horizontal threshold (3× 40px)', () => {
    const rect = makeRect(0, 0, 500, 400);
    // box at x=0.5 (250px). Threshold horizontally = 3 * 40 = 120px.
    // Click 100px to the right → 350px → should still hit.
    const box = makeBox({ id: 'a', x: 0.5, y: 0.5 });
    expect(hitTest(349, 200, rect, [box])).toBe('a');
  });

  it('misses just outside horizontal threshold', () => {
    const rect = makeRect(0, 0, 500, 400);
    // Threshold = 3 * (40/500) = 0.24 → 120px from center (250) → 370px
    const box = makeBox({ id: 'a', x: 0.5, y: 0.5 });
    expect(hitTest(371, 200, rect, [box])).toBeNull();
  });

  it('hits within vertical threshold', () => {
    const rect = makeRect(0, 0, 500, 400);
    // threshold = 40/500 = 0.08 (normalized against width for both axes).
    // box at y=0.5 → 200px. Effective px threshold on y = 0.08 * 400 = 32px.
    // Click 30px below center → 230px → within threshold.
    const box = makeBox({ id: 'a', x: 0.5, y: 0.5 });
    expect(hitTest(250, 230, rect, [box])).toBe('a');
  });

  it('misses just outside vertical threshold', () => {
    const rect = makeRect(0, 0, 500, 400);
    // Effective px threshold on y = 32px. Click 33px below center → 233px.
    const box = makeBox({ id: 'a', x: 0.5, y: 0.5 });
    expect(hitTest(250, 234, rect, [box])).toBeNull();
  });
});
