import {WidgetFixture} from 'sentry-fixture/widget';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {WidgetType} from 'sentry/views/dashboards/types';
import {
  webVitalCountField,
  webVitalScoreField,
} from 'sentry/views/dashboards/utils/webVitalTraceMetricFields';
import {WheelWidgetVisualization} from 'sentry/views/dashboards/widgets/wheelWidget/wheelWidgetVisualization';

describe('WheelWidgetVisualization', () => {
  const mockTableResults: TableDataWithTitle[] = [
    {
      title: 'Web Vitals',
      data: [
        {
          'performance_score(measurements.score.lcp)': 0.85,
          'performance_score(measurements.score.fcp)': 0.9,
          'performance_score(measurements.score.cls)': 0.75,
          'performance_score(measurements.score.ttfb)': 0.8,
          'performance_score(measurements.score.inp)': 0.7,
          'performance_score(measurements.score.total)': 0.8,
          'count_scores(measurements.score.lcp)': 100,
          'count_scores(measurements.score.fcp)': 100,
          'count_scores(measurements.score.cls)': 100,
          'count_scores(measurements.score.ttfb)': 100,
          'count_scores(measurements.score.inp)': 100,
          'count_scores(measurements.score.total)': 100,
          id: '1',
        },
      ],
    },
  ];

  it('renders the performance score ring when data is provided', () => {
    const {container} = render(
      <WheelWidgetVisualization tableResults={mockTableResults} />
    );

    expect(screen.getByText('80')).toBeInTheDocument();
    // eslint-disable-next-line testing-library/no-container
    expect(container.querySelectorAll('circle')).toHaveLength(10); // 2 per vital
  });

  it('computes the scores from trace metric fields', () => {
    const widget = WidgetFixture({widgetType: WidgetType.TRACEMETRICS});
    const tableResults: TableDataWithTitle[] = [
      {
        title: 'Web Vitals',
        data: [
          {
            [webVitalScoreField('lcp')]: 0.5,
            [webVitalScoreField('fcp')]: 1,
            [webVitalScoreField('cls')]: 1,
            [webVitalScoreField('ttfb')]: 1,
            [webVitalScoreField('inp')]: 0,
            [webVitalCountField('lcp')]: 10,
            [webVitalCountField('fcp')]: 10,
            [webVitalCountField('cls')]: 10,
            [webVitalCountField('ttfb')]: 10,
            [webVitalCountField('inp')]: 0,
            id: '1',
          },
        ],
      },
    ];

    const {container} = render(
      <WheelWidgetVisualization tableResults={tableResults} widget={widget} />
    );

    // INP has no data, so the 70 remaining weight points are rescaled to 100:
    // LCP is 30/70 of the total at half score, the rest are full.
    expect(screen.getByText('79')).toBeInTheDocument();
    // eslint-disable-next-line testing-library/no-container
    expect(container.querySelectorAll('circle')).toHaveLength(10); // 2 per vital
  });

  it('returns null when tableResults is undefined', () => {
    const {container} = render(<WheelWidgetVisualization tableResults={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });
});
