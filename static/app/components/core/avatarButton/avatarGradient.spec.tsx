import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {getAvatarGradient, useAvatarGradient} from './avatarGradient';

const FALLBACK = ['#2c155c', '#4e168c'] as const;
const CEILING = FALLBACK[1];

describe('getAvatarGradient', () => {
  it('darkens a saturated avatar color to the ceiling while keeping its hue', () => {
    expect(getAvatarGradient('#6513a6', CEILING)).toEqual(['#360A58', '#520F86']);
  });

  it('darkens a light avatar color well below its original lightness', () => {
    expect(getAvatarGradient('#ffd000', CEILING)).toEqual(['#0F0C00', '#423600']);
  });

  it('leaves an avatar color darker than the ceiling unchanged', () => {
    expect(getAvatarGradient('#1a1a1a', CEILING)).toEqual(['#000000', '#1A1A1A']);
  });
});

describe('useAvatarGradient', () => {
  it('returns the fallback when there is no avatar', () => {
    const {result} = renderHookWithProviders(() =>
      useAvatarGradient(undefined, FALLBACK)
    );

    expect(result.current).toEqual(FALLBACK);
  });

  it('derives the gradient from a letter avatar color', () => {
    const {result} = renderHookWithProviders(() =>
      useAvatarGradient(
        {type: 'letter_avatar', identifier: 'org-slug', name: 'Org Name'},
        FALLBACK
      )
    );

    expect(result.current).not.toEqual(FALLBACK);
    expect(result.current[1]).toMatch(/^#[0-9A-F]{6}$/);
  });
});
