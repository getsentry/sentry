import {
  selectPlatfrom,
  getColorStyles,
  PlatformIconTile,
} from 'app/components/platformIconTile';

describe('platformIconList', function() {
  it('should return appropriate color from selectPlatfrom for a platform when provided with object of colors', function() {
    const platforms = ['javscript'];
    const PLATFORM_COLORS = {javscript: ['#3060b8']};
    expect(selectPlatfrom(PLATFORM_COLORS, platforms)).toEqual(['#3060b8']);
  });
  it('should return appropriate style from getColorStyles for a platform when provided with object of colors', function() {
    const platforms = ['javscript'];
    const arg = {monoTone: '', platforms};
    expect(getColorStyles(arg).styles).toEqual('background-color:#625471;color:#fff;');
  });
  it('should return appropriate JSX', function() {
    expect(PlatformIconTile).toMatchSnapshot();
  });
});
