import {
  dominantColor,
  getAvatarChonk,
  isNeutralColor,
  resolveImageAvatarColors,
  SAMPLE_SIZE,
  shouldPadImage,
  toPageOriginIfSameHost,
} from './avatarImageAnalysis';

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

    await expect(result).resolves.toEqual({
      dominant: '#649632',
      style: 'padded',
    });
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

describe('isNeutralColor', () => {
  it('treats grays, black and white as neutral', () => {
    expect(isNeutralColor('#000000')).toBe(true);
    expect(isNeutralColor('#ffffff')).toBe(true);
    expect(isNeutralColor('#808080')).toBe(true);
  });

  it('treats saturated colors as colored', () => {
    expect(isNeutralColor('#635bff')).toBe(false);
  });
});

describe('getAvatarChonk', () => {
  it('steps the color darker in light mode, keeping hue and chroma', () => {
    expect(getAvatarChonk('#635bff', 'light')).toBe(
      'oklch(from #635bff calc(l - 0.13) c h)'
    );
  });

  it('uses a deep shade of the same hue in dark mode', () => {
    expect(getAvatarChonk('#635bff', 'dark')).toBe(
      'oklch(from #635bff 0.19 min(c, 0.09) h)'
    );
  });

  it('keeps the default chonk for neutral colors', () => {
    expect(getAvatarChonk('#000000', 'light')).toBeUndefined();
    expect(getAvatarChonk('#ffffff', 'dark')).toBeUndefined();
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
