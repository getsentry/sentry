import {render, screen} from 'sentry-test/reactTestingLibrary';

import {BaseChart} from 'sentry/components/charts/baseChart';
import {SeerMarkdown} from 'sentry/components/seer/markdown';

jest.mock('sentry/components/charts/baseChart', () => ({
  BaseChart: jest.fn(() => null),
}));

function renderChart(body: Record<string, unknown>) {
  const raw = `{% chart %}${JSON.stringify(body)}{% /chart %}`;
  render(<SeerMarkdown raw={raw} />);
}

describe('Chart embed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(['line', 'area', 'bar'] as const)(
    'renders a Dashboard %s time-series visualization',
    visualization => {
      renderChart({
        title: 'Error volume',
        subtitle: 'Last three hours',
        visualization,
        x_axis: 'time',
        y_axis_unit: 'number',
        series: [
          {
            label: 'Errors',
            data: [
              {x: '2026-07-30T14:00:00Z', y: 15},
              {x: '2026-07-30T12:00:00Z', y: 12},
              {x: '2026-07-30T13:00:00Z', y: 18},
            ],
          },
        ],
      });

      expect(screen.getByText('Error volume')).toBeInTheDocument();
      expect(screen.getByText('Last three hours')).toBeInTheDocument();
      expect(screen.getByTestId('seer-chart-embed')).toBeInTheDocument();

      const props = jest.mocked(BaseChart).mock.calls.at(-1)![0];
      expect(props.renderer).toBe('canvas');
      expect(props.series).toEqual([
        expect.objectContaining({
          name: 'seer-chart-series-0',
          type: visualization === 'bar' ? 'bar' : 'line',
          data: [
            [Date.parse('2026-07-30T12:00:00Z'), 12],
            [Date.parse('2026-07-30T13:00:00Z'), 18],
            [Date.parse('2026-07-30T14:00:00Z'), 15],
          ],
        }),
      ]);
      expect(props.start).toEqual(new Date('2026-07-30T12:00:00Z'));
      expect(props.end).toEqual(new Date('2026-07-30T14:00:00Z'));
      expect(props.isGroupedByDate).toBe(true);
      if (visualization === 'area') {
        expect(props.series?.[0]).toHaveProperty('areaStyle');
      }
    }
  );

  it('renders category bars with the Dashboard categorical visualization', () => {
    renderChart({
      title: 'Errors by status',
      visualization: 'bar',
      x_axis: 'category',
      series: [
        {
          label: 'Errors',
          data: [
            {x: 200, y: 12},
            {x: 500, y: 4},
          ],
        },
      ],
    });

    const props = jest.mocked(BaseChart).mock.calls.at(-1)![0];
    expect(props.renderer).toBe('canvas');
    expect(props.series).toEqual([
      expect.objectContaining({
        name: 'seer-chart-series-0',
        type: 'bar',
        data: [
          ['200', 12],
          ['500', 4],
        ],
      }),
    ]);
    expect(props.xAxis).toEqual(expect.objectContaining({data: ['200', '500']}));
  });

  it.each([
    ['duration', 500, 500, '500ms'],
    ['percentage', 12.5, 0.125, '12.5%'],
    ['bytes', 1024, 1024, '1.02 kB'],
  ] as const)(
    'uses Dashboard formatting for %s values',
    (unit, inputValue, chartValue, expected) => {
      renderChart({
        title: 'Metric',
        visualization: 'line',
        x_axis: 'time',
        y_axis_unit: unit,
        series: [
          {
            label: 'Metric',
            data: [
              {x: '2026-07-30T12:00:00Z', y: inputValue},
              {x: '2026-07-30T13:00:00Z', y: inputValue},
            ],
          },
        ],
      });

      const props = jest.mocked(BaseChart).mock.calls.at(-1)![0];
      const formatter = (
        Array.isArray(props.yAxes) ? props.yAxes[0]?.axisLabel?.formatter : undefined
      ) as ((axisValue: number) => string) | undefined;
      expect(props.series?.[0]?.data).toEqual([
        [Date.parse('2026-07-30T12:00:00Z'), chartValue],
        [Date.parse('2026-07-30T13:00:00Z'), chartValue],
      ]);
      expect(formatter?.(chartValue)).toBe(expected);
    }
  );

  it.each(['not-a-timestamp', 1_785_405_600])(
    'does not render invalid time-axis value %s',
    value => {
      renderChart({
        title: 'Error volume',
        x_axis: 'time',
        series: [{label: 'Errors', data: [{x: value, y: 12}]}],
      });

      expect(screen.queryByTestId('seer-chart-embed')).not.toBeInTheDocument();
    }
  );

  it.each(['line', 'area'])('does not render a category %s chart', visualization => {
    renderChart({
      title: 'Invalid',
      visualization,
      x_axis: 'category',
      series: [{label: 'Errors', data: [{x: '500', y: 12}]}],
    });

    expect(screen.queryByTestId('seer-chart-embed')).not.toBeInTheDocument();
  });

  it.each(['heatmap', 'wheel'])('does not render removed %s charts', visualization => {
    renderChart({
      title: 'Invalid',
      visualization,
      x_axis: 'category',
      series: [{label: 'Errors', data: [{x: '500', y: 12}]}],
    });

    expect(screen.queryByTestId('seer-chart-embed')).not.toBeInTheDocument();
  });

  it('renders the legacy series name field', () => {
    renderChart({
      title: 'Legacy chart',
      series: [
        {
          name: 'Errors',
          data: [
            {x: '2026-07-30T12:00:00Z', y: 12},
            {x: '2026-07-30T13:00:00Z', y: 18},
          ],
        },
      ],
    });

    expect(screen.getByTestId('seer-chart-embed')).toBeInTheDocument();
  });
});
