import {getWebVitalScoreThresholds} from './scoreThresholds';

describe('getWebVitalScoreThresholds', () => {
  it('uses the desktop scale for desktop', () => {
    expect(getWebVitalScoreThresholds('ttfb', 'desktop')).toEqual({
      p90: 200,
      median: 400,
    });
  });

  it('uses the mobile scale for mobile', () => {
    expect(getWebVitalScoreThresholds('ttfb', 'mobile')).toEqual({
      p90: 800,
      median: 1800,
    });
    expect(getWebVitalScoreThresholds('lcp', 'mobile')).toEqual({
      p90: 2500,
      median: 4000,
    });
  });
});
