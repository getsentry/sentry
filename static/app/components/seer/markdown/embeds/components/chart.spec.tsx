import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AreaChart} from 'sentry/components/charts/areaChart';
import {BarChart} from 'sentry/components/charts/barChart';
import {LineChart} from 'sentry/components/charts/lineChart';
import {SeerMarkdown} from 'sentry/components/seer/markdown';

import {HeatmapChart} from './heatmapChart';
import {WheelChart} from './wheelChart';

jest.mock('sentry/components/charts/areaChart', () => ({
  AreaChart: jest.fn(() => null),
}));
jest.mock('sentry/components/charts/barChart', () => ({
  BarChart: jest.fn(() => null),
}));
jest.mock('sentry/components/charts/lineChart', () => ({
  LineChart: jest.fn(() => null),
}));
jest.mock('./heatmapChart', () => ({
  HeatmapChart: jest.fn(() => null),
}));
jest.mock('./wheelChart', () => ({
  WheelChart: jest.fn(() => null),
}));

describe('Chart embed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['line', LineChart],
    ['area', AreaChart],
    ['bar', BarChart],
  ] as const)(
    'renders a %s chart from a markdown extension',
    (visualization, ChartComponent) => {
      const raw = `{% chart %}${JSON.stringify({
        title: 'Error volume',
        subtitle: 'Last three hours',
        visualization,
        x_axis: 'time',
        y_axis_unit: 'number',
        series: [
          {
            name: 'Errors',
            data: [
              {x: '2026-07-30T12:00:00Z', y: 12},
              {x: '2026-07-30T13:00:00Z', y: 18},
              {x: '2026-07-30T14:00:00Z', y: 15},
            ],
          },
        ],
      })}{% /chart %}`;

      render(<SeerMarkdown raw={raw} />);

      expect(screen.getByText('Error volume')).toBeInTheDocument();
      expect(screen.getByText('Last three hours')).toBeInTheDocument();
      expect(screen.getByTestId('seer-chart-embed')).toBeInTheDocument();
      expect(jest.mocked(ChartComponent)).toHaveBeenCalledWith(
        expect.objectContaining({
          series: [
            {
              seriesName: 'Errors',
              data: [
                {name: Date.parse('2026-07-30T12:00:00Z'), value: 12},
                {name: Date.parse('2026-07-30T13:00:00Z'), value: 18},
                {name: Date.parse('2026-07-30T14:00:00Z'), value: 15},
              ],
            },
          ],
        }),
        undefined
      );
    }
  );

  it('renders a heatmap from the shared series schema', () => {
    const raw = `{% chart %}${JSON.stringify({
      title: 'Latency by browser',
      visualization: 'heatmap',
      x_axis: 'time',
      y_axis_unit: 'duration',
      series: [
        {
          name: 'Chrome',
          data: [
            {x: '2026-07-30T12:00:00Z', y: 120},
            {x: '2026-07-30T13:00:00Z', y: 480},
          ],
        },
        {
          name: 'Safari',
          data: [
            {x: '2026-07-30T12:00:00Z', y: 150},
            {x: '2026-07-30T13:00:00Z', y: 520},
          ],
        },
      ],
    })}{% /chart %}`;

    render(<SeerMarkdown raw={raw} />);

    expect(jest.mocked(HeatmapChart)).toHaveBeenCalledWith(
      expect.objectContaining({
        xAxis: 'time',
        series: [
          {
            seriesName: 'Chrome',
            data: [
              {name: Date.parse('2026-07-30T12:00:00Z'), value: 120},
              {name: Date.parse('2026-07-30T13:00:00Z'), value: 480},
            ],
          },
          {
            seriesName: 'Safari',
            data: [
              {name: Date.parse('2026-07-30T12:00:00Z'), value: 150},
              {name: Date.parse('2026-07-30T13:00:00Z'), value: 520},
            ],
          },
        ],
      }),
      undefined
    );
  });

  it('renders a wheel from one category series', () => {
    const raw = `{% chart %}${JSON.stringify({
      title: 'Issue status',
      visualization: 'wheel',
      x_axis: 'category',
      series: [
        {
          name: 'Issues',
          data: [
            {x: 'Resolved', y: 70},
            {x: 'Unresolved', y: 30},
          ],
        },
      ],
    })}{% /chart %}`;

    render(<SeerMarkdown raw={raw} />);

    expect(jest.mocked(WheelChart)).toHaveBeenCalledWith(
      expect.objectContaining({
        series: {
          seriesName: 'Issues',
          data: [
            {name: 'Resolved', value: 70},
            {name: 'Unresolved', value: 30},
          ],
        },
      }),
      undefined
    );
  });

  it('does not render invalid time-axis values', () => {
    const raw = `{% chart %}${JSON.stringify({
      title: 'Error volume',
      x_axis: 'time',
      series: [{name: 'Errors', data: [{x: 'not-a-timestamp', y: 12}]}],
    })}{% /chart %}`;

    render(<SeerMarkdown raw={raw} />);

    expect(screen.queryByTestId('seer-chart-embed')).not.toBeInTheDocument();
  });

  it.each([
    {
      visualization: 'heatmap',
      x_axis: 'category',
      series: [{name: 'A', data: [{x: 'one', y: -1}]}],
    },
    {
      visualization: 'wheel',
      x_axis: 'time',
      series: [
        {
          name: 'A',
          data: [
            {x: '2026-07-30T12:00:00Z', y: 1},
            {x: '2026-07-30T13:00:00Z', y: 2},
          ],
        },
      ],
    },
    {
      visualization: 'wheel',
      x_axis: 'category',
      series: [
        {
          name: 'A',
          data: [
            {x: 'one', y: 1},
            {x: 'two', y: 2},
          ],
        },
        {
          name: 'B',
          data: [
            {x: 'one', y: 3},
            {x: 'two', y: 4},
          ],
        },
      ],
    },
    {
      visualization: 'wheel',
      x_axis: 'category',
      series: [{name: 'A', data: [{x: 'one', y: 1}]}],
    },
    {
      visualization: 'wheel',
      x_axis: 'category',
      series: [
        {name: 'A', data: Array.from({length: 13}, (_, index) => ({x: index, y: 1}))},
      ],
    },
    {
      visualization: 'wheel',
      x_axis: 'category',
      series: [
        {
          name: 'A',
          data: [
            {x: 'one', y: -1},
            {x: 'two', y: 2},
          ],
        },
      ],
    },
    {
      visualization: 'wheel',
      x_axis: 'category',
      series: [
        {
          name: 'A',
          data: [
            {x: 'one', y: 0},
            {x: 'two', y: 0},
          ],
        },
      ],
    },
  ])('does not render invalid shared-schema visualizations', chart => {
    const raw = `{% chart %}${JSON.stringify({title: 'Invalid', ...chart})}{% /chart %}`;

    render(<SeerMarkdown raw={raw} />);

    expect(screen.queryByTestId('seer-chart-embed')).not.toBeInTheDocument();
  });

  it('escapes category labels before rendering the HTML tooltip', () => {
    const unsafeLabel = '<img src=x onerror=alert(1)>';
    const raw = `{% chart %}${JSON.stringify({
      title: 'Errors by browser',
      visualization: 'bar',
      x_axis: 'category',
      series: [{name: 'Errors', data: [{x: unsafeLabel, y: 12}]}],
    })}{% /chart %}`;

    render(<SeerMarkdown raw={raw} />);

    const tooltip = jest.mocked(BarChart).mock.calls.at(-1)![0].tooltip;
    const formatAxisLabel = tooltip?.formatAxisLabel as
      | ((value: string) => string)
      | undefined;
    expect(formatAxisLabel?.(unsafeLabel)).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });
});
