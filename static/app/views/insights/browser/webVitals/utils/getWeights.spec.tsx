import {getWeights} from 'sentry/views/insights/browser/webVitals/utils/getWeights';

describe('getWeights', () => {
  it('returns the default weights when every web vital has data', () => {
    expect(getWeights(['lcp', 'fcp', 'inp', 'cls', 'ttfb'])).toEqual({
      lcp: 30,
      fcp: 15,
      inp: 30,
      cls: 15,
      ttfb: 10,
    });
  });

  it('redistributes weights across the web vitals that have data', () => {
    expect(getWeights(['lcp', 'inp'])).toEqual({
      lcp: 50,
      fcp: 0,
      inp: 50,
      cls: 0,
      ttfb: 0,
    });
  });

  it('returns zero weights instead of NaN when no web vital has data', () => {
    expect(getWeights([])).toEqual({lcp: 0, fcp: 0, inp: 0, cls: 0, ttfb: 0});
    expect(getWeights()).toEqual({lcp: 0, fcp: 0, inp: 0, cls: 0, ttfb: 0});
  });
});
