import logoUnknown from 'sentry-logos/logo-unknown.svg';

import {getLogoImage} from 'sentry/components/events/contexts/contextIcon';

describe('getLogoImage', () => {
  it('maps context icon aliases to platformicons ids', () => {
    expect(getLogoImage('legacy-edge')).toBe('edge-legacy');
    expect(getLogoImage('mac-os-x')).toBe('apple');
    expect(getLogoImage('google')).toBe('android');
  });

  it('maps prefixed names to supported platformicons ids', () => {
    expect(getLogoImage('amd-ryzen')).toBe('amd');
    expect(getLogoImage('nintendo-switch-oled')).toBe('nintendo-switch');
    expect(getLogoImage('firefox-mobile')).toBe('firefox');
  });

  it('returns the unknown logo sentinel when no platform icon exists', () => {
    expect(getLogoImage('acme-device')).toBe(logoUnknown);
  });
});
