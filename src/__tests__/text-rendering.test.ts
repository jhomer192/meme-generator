import { describe, it, expect } from 'vitest';

// ── Data model types (mirrored from MemeEditor) ──────────────────────────────

interface TextBox {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  outline: boolean;
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function makeDefaultBoxes(): TextBox[] {
  return [
    { id: uid(), text: '', x: 0.5, y: 0.08, fontSize: 48, color: '#ffffff', outline: true },
    { id: uid(), text: '', x: 0.5, y: 0.92, fontSize: 48, color: '#ffffff', outline: true },
  ];
}

// Helpers mirroring the MemeEditor state mutations

function addBox(boxes: TextBox[]): { boxes: TextBox[]; newId: string } {
  const newBox: TextBox = {
    id: uid(),
    text: '',
    x: 0.5,
    y: 0.5,
    fontSize: 48,
    color: '#ffffff',
    outline: true,
  };
  return { boxes: [...boxes, newBox], newId: newBox.id };
}

function deleteBox(boxes: TextBox[], id: string): TextBox[] {
  if (boxes.length <= 1) return boxes; // cannot delete last box
  return boxes.filter((b) => b.id !== id);
}

function updateBox(boxes: TextBox[], id: string, patch: Partial<TextBox>): TextBox[] {
  return boxes.map((b) => (b.id === id ? { ...b, ...patch } : b));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('makeDefaultBoxes', () => {
  it('creates exactly two text boxes', () => {
    expect(makeDefaultBoxes()).toHaveLength(2);
  });

  it('top box has y=0.08 and x=0.5', () => {
    const [top] = makeDefaultBoxes();
    expect(top.x).toBe(0.5);
    expect(top.y).toBe(0.08);
  });

  it('bottom box has y=0.92 and x=0.5', () => {
    const [, bottom] = makeDefaultBoxes();
    expect(bottom.x).toBe(0.5);
    expect(bottom.y).toBe(0.92);
  });

  it('default boxes start with empty text', () => {
    const boxes = makeDefaultBoxes();
    expect(boxes.every((b) => b.text === '')).toBe(true);
  });

  it('default boxes have white color and outline enabled', () => {
    const boxes = makeDefaultBoxes();
    expect(boxes.every((b) => b.color === '#ffffff' && b.outline === true)).toBe(true);
  });
});

describe('addBox', () => {
  it('places new box at center (x=0.5, y=0.5)', () => {
    const { boxes } = addBox(makeDefaultBoxes());
    const newBox = boxes[boxes.length - 1];
    expect(newBox.x).toBe(0.5);
    expect(newBox.y).toBe(0.5);
  });

  it('appends to the end of the array', () => {
    const initial = makeDefaultBoxes();
    const { boxes } = addBox(initial);
    expect(boxes).toHaveLength(3);
  });

  it('new box starts with empty text', () => {
    const { boxes } = addBox(makeDefaultBoxes());
    expect(boxes[boxes.length - 1].text).toBe('');
  });
});

describe('deleteBox', () => {
  it('removes the specified box', () => {
    const boxes = makeDefaultBoxes();
    const id = boxes[0].id;
    const result = deleteBox(boxes, id);
    expect(result.some((b) => b.id === id)).toBe(false);
  });

  it('reduces length by 1', () => {
    const boxes = makeDefaultBoxes();
    const result = deleteBox(boxes, boxes[0].id);
    expect(result).toHaveLength(1);
  });

  it('cannot delete the last text box', () => {
    const boxes = makeDefaultBoxes();
    const after1 = deleteBox(boxes, boxes[0].id);
    expect(after1).toHaveLength(1);
    // Trying to delete the remaining single box must be a no-op
    const after2 = deleteBox(after1, after1[0].id);
    expect(after2).toHaveLength(1);
  });
});

describe('updateBox', () => {
  it('updates text content', () => {
    const boxes = makeDefaultBoxes();
    const id = boxes[0].id;
    const result = updateBox(boxes, id, { text: 'Hello World' });
    expect(result.find((b) => b.id === id)?.text).toBe('Hello World');
  });

  it('updates font size', () => {
    const boxes = makeDefaultBoxes();
    const id = boxes[0].id;
    const result = updateBox(boxes, id, { fontSize: 72 });
    expect(result.find((b) => b.id === id)?.fontSize).toBe(72);
  });

  it('updates color', () => {
    const boxes = makeDefaultBoxes();
    const id = boxes[0].id;
    const result = updateBox(boxes, id, { color: '#ff0000' });
    expect(result.find((b) => b.id === id)?.color).toBe('#ff0000');
  });

  it('does not mutate other boxes', () => {
    const boxes = makeDefaultBoxes();
    const [box0, box1] = boxes;
    const result = updateBox(boxes, box0.id, { text: 'changed' });
    expect(result.find((b) => b.id === box1.id)?.text).toBe('');
  });
});
