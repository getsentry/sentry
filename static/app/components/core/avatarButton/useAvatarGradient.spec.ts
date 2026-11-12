// eslint-disable-next-line no-restricted-imports
import color from 'color';

import {getAvatarGradient} from './useAvatarGradient';

const DEFAULT_GRADIENT = {start: '#2c155c', end: '#4e168c'};

describe('getAvatarGradient', () => {
  it('keeps bright colors from starting near black', () => {
    const gradient = getAvatarGradient('#ffd744', DEFAULT_GRADIENT);

    // The HSL version started this gradient at #0f0c00.
    expect(color(gradient.start).luminosity()).toBeGreaterThan(
      color(DEFAULT_GRADIENT.start).luminosity() * 0.8
    );
    // Within 8-bit rounding of the avatar's hue.
    for (const stop of [gradient.start, gradient.end]) {
      expect(Math.abs(color(stop).hue() - color('#ffd744').hue())).toBeLessThan(3);
    }
  });

  it.each(['#ffd744', '#00ff00', '#00ffff', '#0000ff', '#e3442a'])(
    'keeps white text as readable as on the default gradient for %s',
    avatarColor => {
      const gradient = getAvatarGradient(avatarColor, DEFAULT_GRADIENT);
      const white = color('#ffffff');

      for (const stop of ['start', 'end'] as const) {
        expect(white.contrast(color(gradient[stop]))).toBeGreaterThan(
          white.contrast(color(DEFAULT_GRADIENT[stop])) * 0.85
        );
      }
    }
  );

  it('leaves colors darker than the default gradient unchanged', () => {
    expect(getAvatarGradient('#1a0838', DEFAULT_GRADIENT)).toEqual({
      start: '#1A0838',
      end: '#1A0838',
    });
  });

  it('only darkens the stops that are lighter than the default', () => {
    const gradient = getAvatarGradient('#12424a', DEFAULT_GRADIENT);

    expect(gradient.end).toBe('#12424A');
    expect(color(gradient.start).luminosity()).toBeLessThan(
      color('#12424a').luminosity()
    );
  });

  it.each(['#000000', '#808080', '#ffffff', '#1a1a1a'])(
    'keeps the default gradient for the neutral color %s',
    avatarColor => {
      expect(getAvatarGradient(avatarColor, DEFAULT_GRADIENT)).toBe(DEFAULT_GRADIENT);
    }
  );
});
