import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {PageFilters} from 'sentry/types/core';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {WheelWidgetVisualization} from 'sentry/views/dashboards/widgets/wheelWidget/wheelWidgetVisualization';

describe('WheelWidgetVisualization', () => {
  const mockSelection: PageFilters = {
    datetime: {
      period: '7d',
      start: null,
      end: null,
      utc: null,
    },
    projects: [],
    environments: [],
  };

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
      <WheelWidgetVisualization
        tableResults={mockTableResults}
        loading={false}
        selection={mockSelection}
      />
    );

    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    // eslint-disable-next-line testing-library/no-container
    expect(container.querySelectorAll('circle')).toHaveLength(10); // 2 per vital
  });

  it('returns null when tableResults is undefined', () => {
    const {container} = render(
      <WheelWidgetVisualization
        tableResults={undefined}
        loading={false}
        selection={mockSelection}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
