import {getLogoImage} from 'sentry/components/events/contexts/contextIcon';

describe('getLogoImage', () => {
  it('maps context icon aliases to platformicons ids', () => {
    expect(getLogoImage('legacy-edge')).toBe('edge-legacy');
    expect(getLogoImage('mac-os-x')).toBe('apple');
    expect(getLogoImage('google')).toBe('google');
  });

  it('maps prefixed names to supported platformicons ids', () => {
    expect(getLogoImage('amd-ryzen')).toBe('amd');
    expect(getLogoImage('nintendo-switch-oled')).toBe('nintendo-switch');
    expect(getLogoImage('firefox-mobile')).toBe('firefox');
  });

  it('passes through identifiers shipped by platformicons', () => {
    expect(getLogoImage('convex')).toBe('convex');
    expect(getLogoImage('javascript-effect')).toBe('javascript-effect');
    expect(getLogoImage('javascript-nitro')).toBe('javascript-nitro');
  });

  it('returns null when no platform icon exists', () => {
    expect(getLogoImage('acme-device')).toBeNull();
  });
});
