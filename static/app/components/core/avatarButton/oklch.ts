// Minimal OKLCH <-> sRGB conversion (https://bottosson.github.io/posts/oklab/).

interface Oklch {
  c: number;
  h: number;
  l: number;
}

type Rgb = [number, number, number];

function decode(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function encode(linear: number): number {
  const c = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, c)) * 255);
}

/**
 * Parses a `#rgb` or `#rrggbb` hex string into its 0-255 channels. The short
 * form is expanded first, so `#fff` reads as white rather than `#000fff`.
 */
export function hexToRgb(hex: string): Rgb {
  const digits = hex.replace(/^#/, '');
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map(d => d + d)
          .join('')
      : digits;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = hexToRgb(hex).map(decode) as Rgb;

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  return {
    l: L,
    c: Math.hypot(A, B),
    h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360,
  };
}

function oklchToLinearRgb({l: L, c, h}: Oklch): Rgb {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);

  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function inGamut(rgb: Rgb): boolean {
  return rgb.every(v => v >= -1e-4 && v <= 1 + 1e-4);
}

/**
 * Converts to sRGB hex, lowering chroma until the color fits. The browser
 * clips out-of-gamut colors per channel instead, which shifts the hue: a dark,
 * saturated orange clips to plain red.
 */
export function oklchToHex(color: Oklch): string {
  let rgb = oklchToLinearRgb(color);

  if (!inGamut(rgb)) {
    let low = 0;
    let high = color.c;
    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2;
      if (inGamut(oklchToLinearRgb({...color, c: mid}))) {
        low = mid;
      } else {
        high = mid;
      }
    }
    rgb = oklchToLinearRgb({...color, c: low});
  }

  return `#${rgb.map(v => encode(v).toString(16).padStart(2, '0')).join('')}`;
}
