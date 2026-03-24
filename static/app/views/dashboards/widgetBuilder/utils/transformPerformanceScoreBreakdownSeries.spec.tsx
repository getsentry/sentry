import {transformPerformanceScoreBreakdownSeries} from 'sentry/views/dashboards/widgetBuilder/utils/transformPerformanceScoreBreakdownSeries';

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
