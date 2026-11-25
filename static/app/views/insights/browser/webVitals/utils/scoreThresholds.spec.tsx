import {BrowserType} from './queryParameterDecoders/browserType';
import {getWebVitalScoreThresholds} from './scoreThresholds';

describe('getWebVitalScoreThresholds', () => {
  it('uses the desktop scale for desktop browsers', () => {
    expect(
      getWebVitalScoreThresholds('ttfb', [BrowserType.CHROME, BrowserType.SAFARI])
    ).toEqual({p90: 200, median: 400});
  });

  it('uses the mobile scale for mobile browsers', () => {
    expect(
      getWebVitalScoreThresholds('ttfb', [
        BrowserType.CHROME_MOBILE,
        BrowserType.SAFARI_MOBILE,
      ])
    ).toEqual({p90: 800, median: 1800});
    expect(getWebVitalScoreThresholds('lcp', [BrowserType.CHROME_MOBILE])).toEqual({
      p90: 2500,
      median: 4000,
    });
  });

  it('returns no scale when desktop and mobile browsers are mixed', () => {
    expect(
      getWebVitalScoreThresholds('ttfb', [BrowserType.CHROME, BrowserType.CHROME_MOBILE])
    ).toBeUndefined();
  });

  it('returns no scale when no browser is selected', () => {
    expect(getWebVitalScoreThresholds('ttfb', [])).toBeUndefined();
    expect(getWebVitalScoreThresholds('ttfb', [BrowserType.ALL])).toBeUndefined();
  });
});
