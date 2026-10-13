import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {
  transformPerformanceScoreBreakdownSeries,
  transformPerformanceScoreBreakdownTimeSeries,
} from 'sentry/views/dashboards/widgetBuilder/utils/transformPerformanceScoreBreakdownSeries';

describe('transformPerformanceScoreBreakdownSeries', () => {
  it('transforms performace score breakdown series', () => {
    const series = transformPerformanceScoreBreakdownSeries({
      'performance_score(measurements.score.lcp)': {
        data: [[1, [{count: 0.5}]]],
      },
      'performance_score(measurements.score.fcp)': {
        data: [[1, [{count: 0.5}]]],
      },
      'performance_score(measurements.score.cls)': {
        data: [[1, [{count: 0.5}]]],
      },
      'performance_score(measurements.score.inp)': {
        data: [[1, [{count: 0.5}]]],
      },
      'performance_score(measurements.score.ttfb)': {
        data: [[1, [{count: 0.5}]]],
      },
    });

    expect(series).toEqual({
      'performance_score(measurements.score.lcp)': {
        data: [
          [
            1,
            [
              {
                count: 15,
              },
            ],
          ],
        ],
      },
      'performance_score(measurements.score.fcp)': {
        data: [[1, [{count: 7.5}]]],
      },
      'performance_score(measurements.score.cls)': {
        data: [[1, [{count: 7.5}]]],
      },
      'performance_score(measurements.score.inp)': {
        data: [[1, [{count: 15}]]],
      },
      'performance_score(measurements.score.ttfb)': {
        data: [[1, [{count: 5}]]],
      },
    });
  });

  it('transforms equation format performance score breakdown series', () => {
    const series = transformPerformanceScoreBreakdownSeries({
      'equation|performance_score(measurements.score.lcp)': {
        data: [[1, [{count: 0.5}]]],
      },
      'equation|performance_score(measurements.score.fcp)': {
        data: [[1, [{count: 0.5}]]],
      },
      'equation|performance_score(measurements.score.cls)': {
        data: [[1, [{count: 0.5}]]],
      },
      'equation|performance_score(measurements.score.inp)': {
        data: [[1, [{count: 0.5}]]],
      },
      'equation|performance_score(measurements.score.ttfb)': {
        data: [[1, [{count: 0.5}]]],
      },
    });

    expect(series).toEqual({
      'equation|performance_score(measurements.score.lcp)': {
        data: [
          [
            1,
            [
              {
                count: 15,
              },
            ],
          ],
        ],
      },
      'equation|performance_score(measurements.score.fcp)': {
        data: [[1, [{count: 7.5}]]],
      },
      'equation|performance_score(measurements.score.cls)': {
        data: [[1, [{count: 7.5}]]],
      },
      'equation|performance_score(measurements.score.inp)': {
        data: [[1, [{count: 15}]]],
      },
      'equation|performance_score(measurements.score.ttfb)': {
        data: [[1, [{count: 5}]]],
      },
    });
  });
});

const WEB_VITALS = ['lcp', 'fcp', 'cls', 'inp', 'ttfb'];

function makeTimeSeries(yAxis: string, value: number) {
  return TimeSeriesFixture({
    yAxis,
    meta: {valueType: 'score', valueUnit: null, interval: 3_600_000},
    values: [{timestamp: 1000, value}],
  });
}

describe('transformPerformanceScoreBreakdownTimeSeries', () => {
  it.each(['', 'equation|'])('weights each web vital score (prefix: "%s")', prefix => {
    const result = transformPerformanceScoreBreakdownTimeSeries({
      timeSeries: WEB_VITALS.map(webVital =>
        makeTimeSeries(`${prefix}performance_score(measurements.score.${webVital})`, 0.5)
      ),
    });

    expect(result.timeSeries.map(({yAxis, values}) => [yAxis, values[0]!.value])).toEqual(
      [
        [`${prefix}performance_score(measurements.score.lcp)`, 15],
        [`${prefix}performance_score(measurements.score.fcp)`, 7.5],
        [`${prefix}performance_score(measurements.score.inp)`, 15],
        [`${prefix}performance_score(measurements.score.cls)`, 7.5],
        [`${prefix}performance_score(measurements.score.ttfb)`, 5],
      ]
    );
  });

  it('leaves grouped series unchanged', () => {
    const data = {
      timeSeries: [
        TimeSeriesFixture({
          yAxis: 'performance_score(measurements.score.lcp)',
          groupBy: [{key: 'browser.name', value: 'Chrome'}],
        }),
      ],
    };

    expect(transformPerformanceScoreBreakdownTimeSeries(data)).toBe(data);
  });
});
