import type {CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams} from 'echarts';
import {ThemeFixture} from 'sentry-fixture/theme';

import {
  BAND_HEIGHT,
  bandHoverTarget,
  bandLayout,
  bandRect,
  bucketHighlight,
} from './bandShapes';

const track = {left: 0, right: 600};

describe('bandRect', () => {
  it('rounds only the corners on the ends of the track', () => {
    expect(bandRect({left: 0, right: 30}, 0, track, 'red')).toMatchObject({
      silent: true,
      shape: {r: [2, 0, 0, 2]},
    });
    expect(bandRect({left: 30, right: 60}, 0, track, 'red')).toMatchObject({
      shape: {r: [0, 0, 0, 0]},
    });
    expect(bandRect({left: 570, right: 600}, 0, track, 'red')).toMatchObject({
      shape: {r: [0, 2, 2, 0]},
    });
  });
});

const params = {
  coordSys: {type: 'cartesian2d', x: 10, y: 20, width: 600, height: 200},
} as unknown as CustomSeriesRenderItemParams;

describe('bandHoverTarget', () => {
  it('spans the full band height so stacked bands leave no gap', () => {
    const api = {coord: () => [0, 220]} as unknown as CustomSeriesRenderItemAPI;
    const bucket = {start: 0, end: 60_000};
    const [first, second] = [0, BAND_HEIGHT].map(offset =>
      bandHoverTarget({left: 100, right: 160}, bandLayout(bucket, offset, params, api)!.y)
    );

    expect(first).toMatchObject({
      shape: {x: 100, y: 220, width: 60, height: BAND_HEIGHT},
      style: {fill: 'transparent'},
    });
    expect(second).toMatchObject({shape: {y: 220 + BAND_HEIGHT}});
  });
});

describe('bucketHighlight', () => {
  const theme = ThemeFixture();

  it('dims the plot on either side of the bucket and washes the bucket', () => {
    expect(bucketHighlight({left: 100, right: 160}, params, theme)).toMatchObject([
      {
        shape: {x: 10, y: 20, width: 90, height: 200},
        style: {fill: theme.tokens.background.primary},
      },
      {
        shape: {x: 160, y: 20, width: 450, height: 200},
        style: {fill: theme.tokens.background.primary},
      },
      {
        shape: {x: 100, y: 20, width: 60, height: 200},
        style: {fill: theme.tokens.graphics.accent.vibrant},
      },
    ]);
  });

  it('stays hidden and out of the way until the bucket is hovered', () => {
    for (const rect of bucketHighlight({left: 100, right: 160}, params, theme)) {
      expect(rect).toMatchObject({
        silent: true,
        style: {opacity: 0},
        emphasis: {style: {opacity: expect.any(Number)}},
      });
    }
  });

  it('clamps the bucket to the plot', () => {
    const [left, right, bucket] = bucketHighlight({left: -20, right: 40}, params, theme);

    expect(left).toMatchObject({shape: {x: 10, width: 0}});
    expect(right).toMatchObject({shape: {x: 40, width: 570}});
    expect(bucket).toMatchObject({shape: {x: 10, width: 30}});
  });
});
