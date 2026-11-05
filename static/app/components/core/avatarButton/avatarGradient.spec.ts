import {getAvatarGradient} from './avatarGradient';

const CEILING = '#4e168c';

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
