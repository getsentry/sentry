import {LocationFixture} from 'sentry-fixture/locationFixture';

import {decodeHistogramZoom} from './utils';

describe('decodeHistogramZoom', () => {
  it('returns no bounds when the zoom params are absent', () => {
    const location = LocationFixture({query: {}});

    const zoom = decodeHistogramZoom(location);

    expect(zoom).toEqual({min: undefined, max: undefined});
  });

  it('returns both bounds when the zoom params are integers', () => {
    const location = LocationFixture({
      query: {startDuration: '100', endDuration: '250'},
    });

    const zoom = decodeHistogramZoom(location);

    expect(zoom).toEqual({min: 100, max: 250});
  });

  it('zooms from 0 when the start is present but not an integer', () => {
    const location = LocationFixture({query: {startDuration: 'abc', endDuration: ''}});

    const zoom = decodeHistogramZoom(location);

    expect(zoom).toEqual({min: 0, max: undefined});
  });

  it('reads the first value when the zoom params repeat', () => {
    const location = LocationFixture({
      query: {startDuration: ['5', '9'], endDuration: ['20', '30']},
    });

    const zoom = decodeHistogramZoom(location);

    expect(zoom).toEqual({min: 5, max: 20});
  });
});
