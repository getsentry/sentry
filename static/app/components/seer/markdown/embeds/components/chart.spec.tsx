import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AreaChart} from 'sentry/components/charts/areaChart';
import {BarChart} from 'sentry/components/charts/barChart';
import {LineChart} from 'sentry/components/charts/lineChart';
import {SeerMarkdown} from 'sentry/components/seer/markdown';

jest.mock('sentry/components/charts/areaChart', () => ({
  AreaChart: jest.fn(() => null),
}));
jest.mock('sentry/components/charts/barChart', () => ({
  BarChart: jest.fn(() => null),
}));
jest.mock('sentry/components/charts/lineChart', () => ({
  LineChart: jest.fn(() => null),
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

  it('does not render invalid time-axis values', () => {
    const raw = `{% chart %}${JSON.stringify({
      title: 'Error volume',
      x_axis: 'time',
      series: [{name: 'Errors', data: [{x: 'not-a-timestamp', y: 12}]}],
    })}{% /chart %}`;

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
