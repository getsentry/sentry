import {
  bottomEdgeColor,
  imageLayout,
  opaquePixels,
  resolveImageAvatarColors,
  SAMPLE_SIZE,
  toPageOriginIfSameHost,
} from './avatarImageAnalysis';
import {tintColor} from './tintColor';

describe('resolveImageAvatarColors', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('samples a cross-origin image with anonymous CORS without using fetch', async () => {
    const image = document.createElement('img');
    jest.spyOn(window, 'Image').mockImplementation(() => image);
    const fetchSpy = jest.spyOn(window, 'fetch');
    const context = document.createElement('canvas').getContext('2d')!;
    jest.spyOn(context, 'getImageData').mockReturnValue({
      data: makePixelData((col, row) =>
        col === 0 || row === 0 ? [0, 0, 0, 0] : [100, 150, 50, 255]
      ),
    } as ImageData);
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);

    const result = resolveImageAvatarColors('https://example.com/avatar/logo/');

    expect(image.crossOrigin).toBe('anonymous');
    expect(image.src).toBe('https://example.com/avatar/logo/');
    image.dispatchEvent(new Event('load'));

    await expect(result).resolves.toEqual({tint: '#649632', style: 'padded'});
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null when the image cannot be loaded', async () => {
    const image = document.createElement('img');
    jest.spyOn(window, 'Image').mockImplementation(() => image);

    const result = resolveImageAvatarColors('https://example.com/avatar/missing/');
    image.dispatchEvent(new Event('error'));

    await expect(result).resolves.toBeNull();
  });
});

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

describe('imageLayout', () => {
  it('returns fill for a fully opaque image', () => {
    const data = makePixelData(() => [200, 100, 50, 255]);
    expect(imageLayout(data)).toEqual({style: 'fill', edge: '#c86432'});
  });

  it('returns padded when the left edge is transparent', () => {
    const data = makePixelData((col, _row) =>
      col === 0 ? [0, 0, 0, 0] : [200, 100, 50, 255]
    );
    expect(imageLayout(data)).toEqual({style: 'padded'});
  });

  it('returns padded when the right edge is transparent', () => {
    const data = makePixelData((col, _row) =>
      col === SAMPLE_SIZE - 1 ? [0, 0, 0, 0] : [200, 100, 50, 255]
    );
    expect(imageLayout(data)).toEqual({style: 'padded'});
  });

  it('returns padded when the top edge is transparent', () => {
    const data = makePixelData((_col, row) =>
      row === 0 ? [0, 0, 0, 0] : [200, 100, 50, 255]
    );
    expect(imageLayout(data)).toEqual({style: 'padded'});
  });

  it('returns padded when the bottom edge is transparent', () => {
    const data = makePixelData((_col, row) =>
      row === SAMPLE_SIZE - 1 ? [0, 0, 0, 0] : [200, 100, 50, 255]
    );
    expect(imageLayout(data)).toEqual({style: 'padded'});
  });

  it('returns padded when any corner is transparent', () => {
    const data = makePixelData((col, row) =>
      col === 0 && row === 0 ? [0, 0, 0, 0] : [200, 100, 50, 255]
    );
    expect(imageLayout(data)).toEqual({style: 'padded'});
  });
});

describe('tintColor', () => {
  it('returns the dominant color of a uniform image', () => {
    const data = makePixelData(() => [0, 100, 200, 255]);
    expect(tintColor(opaquePixels(data))).toBe('#0064c8');
  });

  it('returns null for all-transparent data', () => {
    const data = makePixelData(() => [0, 0, 0, 0]);
    expect(tintColor(opaquePixels(data))).toBeNull();
  });

  it('returns null for a gray logo', () => {
    const data = makePixelData(() => [128, 128, 128, 255]);
    expect(tintColor(opaquePixels(data))).toBeNull();
  });

  it('ignores a small colored accent next to gray content', () => {
    // A small orange icon beside a gray wordmark.
    const data = makePixelData((col, row) =>
      col < 4 && row < 4 ? [252, 109, 38, 255] : [100, 100, 100, 255]
    );
    expect(tintColor(opaquePixels(data))).toBeNull();
  });

  it('does not count a white plate against the logo color', () => {
    // A green mark on a white background, like a logo on a light plate.
    const data = makePixelData((col, row) =>
      col < 10 && row < 10 ? [118, 185, 0, 255] : [255, 255, 255, 255]
    );
    expect(tintColor(opaquePixels(data))).toBe('#76b900');
  });

  it('has no tint when split across unrelated hues', () => {
    // Four equal quadrants in four different hues, like a multicolor mark.
    const quadrants: Array<[number, number, number, number]> = [
      [224, 30, 90, 255],
      [54, 197, 240, 255],
      [46, 182, 125, 255],
      [236, 178, 46, 255],
    ];
    const half = SAMPLE_SIZE / 2;
    const data = makePixelData(
      (col, row) => quadrants[(row < half ? 0 : 2) + (col < half ? 0 : 1)]!
    );
    expect(tintColor(opaquePixels(data))).toBeNull();
  });

  it('keeps the color of a logo with a single dominant hue', () => {
    const data = makePixelData((col, _row) =>
      col < SAMPLE_SIZE / 2 ? [99, 91, 255, 255] : [80, 70, 230, 255]
    );
    expect(tintColor(opaquePixels(data))).not.toBeNull();
  });

  it('compares hues perceptually, so lime highlights count as green', () => {
    // Green and lime sit 40° apart in HSV but only ~12° apart in OKLCH, where
    // they look like one hue. A blue accent keeps green under half the pixels,
    // so the logo only stays green if the lime counts as agreeing.
    const data = makePixelData((col, _row) =>
      col < 14 ? [0, 200, 0, 255] : col < 24 ? [160, 240, 0, 255] : [0, 0, 200, 255]
    );
    expect(tintColor(opaquePixels(data))).toBe('#00c800');
  });

  it('prefers chromatic over grayscale when both exist', () => {
    const data = makePixelData((col, _row) =>
      col < SAMPLE_SIZE / 2 ? [128, 128, 128, 255] : [0, 0, 200, 255]
    );
    const result = tintColor(opaquePixels(data));
    expect(result).not.toBeNull();
    const b = parseInt(result!.slice(5, 7), 16);
    expect(b).toBeGreaterThan(150);
  });
});

describe('bottomEdgeColor', () => {
  it('averages the opaque pixels along the bottom', () => {
    const data = makePixelData((_col, row) =>
      row >= SAMPLE_SIZE - 2 ? [51, 25, 111, 255] : [99, 52, 233, 255]
    );
    expect(bottomEdgeColor(data)).toBe('#33196f');
  });

  it('returns null when the bottom is transparent', () => {
    const data = makePixelData((_col, row) =>
      row >= SAMPLE_SIZE - 2 ? [0, 0, 0, 0] : [99, 52, 233, 255]
    );
    expect(bottomEdgeColor(data)).toBeNull();
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
