// eslint-disable-next-line no-restricted-imports
import color from 'color';

import {
  darkenUntilContrasts,
  dominantColor,
  MIN_EDGE_CONTRAST,
  SAMPLE_SIZE,
  shouldPadImage,
  toPageOriginIfSameHost,
} from './avatarImageAnalysis';

function makePixelData(
  fill: (col: number, row: number) => [number, number, number, number]
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(SAMPLE_SIZE * SAMPLE_SIZE * 4);
  for (let row = 0; row < SAMPLE_SIZE; row++) {
    for (let col = 0; col < SAMPLE_SIZE; col++) {
      const [r, g, b, a] = fill(col, row);
      const i = (row * SAMPLE_SIZE + col) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return data;
}

describe('shouldPadImage', () => {
  it('returns fill for a fully opaque image', () => {
    const data = makePixelData(() => [200, 100, 50, 255]);
    expect(shouldPadImage(data)).toBe('fill');
  });

  it('returns padded when the left edge is transparent', () => {
    const data = makePixelData((col, _row) =>
      col === 0 ? [0, 0, 0, 0] : [200, 100, 50, 255]
    );
    expect(shouldPadImage(data)).toBe('padded');
  });

  it('returns padded when the right edge is transparent', () => {
    const data = makePixelData((col, _row) =>
      col === SAMPLE_SIZE - 1 ? [0, 0, 0, 0] : [200, 100, 50, 255]
    );
    expect(shouldPadImage(data)).toBe('padded');
  });

  it('returns padded when the top edge is transparent', () => {
    const data = makePixelData((_col, row) =>
      row === 0 ? [0, 0, 0, 0] : [200, 100, 50, 255]
    );
    expect(shouldPadImage(data)).toBe('padded');
  });

  it('returns padded when the bottom edge is transparent', () => {
    const data = makePixelData((_col, row) =>
      row === SAMPLE_SIZE - 1 ? [0, 0, 0, 0] : [200, 100, 50, 255]
    );
    expect(shouldPadImage(data)).toBe('padded');
  });

  it('returns padded when any corner is transparent', () => {
    const data = makePixelData((col, row) =>
      col === 0 && row === 0 ? [0, 0, 0, 0] : [200, 100, 50, 255]
    );
    expect(shouldPadImage(data)).toBe('padded');
  });
});

describe('dominantColor', () => {
  it('returns the dominant color of a uniform image', () => {
    const data = makePixelData(() => [0, 100, 200, 255]);
    expect(dominantColor(data)).toBe('#0064c8');
  });

  it('returns null for all-transparent data', () => {
    const data = makePixelData(() => [0, 0, 0, 0]);
    expect(dominantColor(data)).toBeNull();
  });

  it('prefers chromatic over grayscale when both exist', () => {
    const data = makePixelData((col, _row) =>
      col < 6 ? [128, 128, 128, 255] : [0, 0, 200, 255]
    );
    const result = dominantColor(data);
    expect(result).not.toBeNull();
    const b = parseInt(result!.slice(5, 7), 16);
    expect(b).toBeGreaterThan(150);
  });
});

describe('darkenUntilContrasts', () => {
  it('returns a color with sufficient contrast against the original', () => {
    const result = darkenUntilContrasts('#888888', 'light');
    const contrast = color(result).contrast(color('#888888'));
    expect(contrast).toBeGreaterThanOrEqual(MIN_EDGE_CONTRAST);
  });

  it('lightens near-black colors to reach contrast', () => {
    const result = darkenUntilContrasts('#0A0A0A', 'light');
    const contrast = color(result).contrast(color('#0A0A0A'));
    expect(contrast).toBeGreaterThanOrEqual(MIN_EDGE_CONTRAST);
    expect(color(result).luminosity()).toBeGreaterThan(color('#0A0A0A').luminosity());
  });
});

describe('toPageOriginIfSameHost', () => {
  it('coerces same-host different-protocol URLs to page origin', () => {
    const result = toPageOriginIfSameHost('https://localhost/avatar/123');
    expect(result).toBe('http://localhost/avatar/123');
  });

  it('leaves truly cross-origin URLs untouched', () => {
    const result = toPageOriginIfSameHost('https://gravatar.com/avatar/abc');
    expect(result).toBe('https://gravatar.com/avatar/abc');
  });

  it('returns the input for malformed URLs', () => {
    const result = toPageOriginIfSameHost('not a url at all');
    expect(typeof result).toBe('string');
  });
});
