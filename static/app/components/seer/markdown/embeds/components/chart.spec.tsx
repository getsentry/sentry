import {render, screen} from 'sentry-test/reactTestingLibrary';

import {BaseChart} from 'sentry/components/charts/baseChart';
import {SeerMarkdown} from 'sentry/components/seer/markdown';

jest.mock('sentry/components/charts/baseChart', () => ({
  BaseChart: jest.fn(() => null),
}));

describe('Chart embed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(['line', 'area', 'bar'] as const)(
    'renders a %s chart from a markdown extension',
    visualization => {
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
      const props = jest.mocked(BaseChart).mock.calls.at(-1)![0];
      expect(props.series).toEqual([
        expect.objectContaining({
          name: 'Errors',
          type: visualization === 'bar' ? 'bar' : 'line',
        }),
      ]);
      if (visualization === 'area') {
        expect(props.series?.[0]).toHaveProperty('areaStyle');
      }
    }
  );

  it('stacks multiple area series so each remains visible', () => {
    const raw = `{% chart %}${JSON.stringify({
      title: 'Errors by browser',
      visualization: 'area',
      x_axis: 'category',
      series: [
        {name: 'Chrome', data: [{x: 'Monday', y: 12}]},
        {name: 'Safari', data: [{x: 'Monday', y: 8}]},
      ],
    })}{% /chart %}`;

    render(<SeerMarkdown raw={raw} />);

    const props = jest.mocked(BaseChart).mock.calls.at(-1)![0];
    expect(props.series).toEqual([
      expect.objectContaining({name: 'Chrome', stack: 'area'}),
      expect.objectContaining({name: 'Safari', stack: 'area'}),
    ]);
  });

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
            {x: '2026-07-31T12:00:00Z', y: 480},
            {x: '2026-07-30T12:00:00Z', y: 120},
          ],
        },
        {
          name: 'Safari',
          data: [
            {x: '2026-07-30T12:00:00Z', y: 150},
            {x: '2026-07-31T12:00:00Z', y: 520},
          ],
        },
      ],
    })}{% /chart %}`;

    render(<SeerMarkdown raw={raw} />);

    const props = jest.mocked(BaseChart).mock.calls.at(-1)![0];
    expect(props).toEqual(
      expect.objectContaining({
        series: [
          expect.objectContaining({
            type: 'heatmap',
            data: [
              [1, 0, 480],
              [0, 0, 120],
              [0, 1, 150],
              [1, 1, 520],
            ],
          }),
        ],
        visualMap: expect.objectContaining({min: 0, max: 520}),
        xAxis: expect.objectContaining({
          type: 'category',
          data: [Date.parse('2026-07-30T12:00:00Z'), Date.parse('2026-07-31T12:00:00Z')],
        }),
        yAxis: {type: 'category', data: ['Chrome', 'Safari']},
      })
    );
    const formatColumn = props.xAxis?.axisLabel?.formatter as
      | ((value: number) => string)
      | undefined;
    expect(formatColumn?.(Date.parse('2026-07-30T12:00:00Z'))).not.toBe(
      formatColumn?.(Date.parse('2026-07-31T12:00:00Z'))
    );
    const tooltipFormatter = props.tooltip?.formatter as
      | ((params: {value: [number, number, number]}) => string)
      | undefined;
    expect(tooltipFormatter?.({value: [0, 0, 120]})).toContain('<strong>Chrome</strong>');
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

    const props = jest.mocked(BaseChart).mock.calls.at(-1)![0];
    expect(props).toEqual(
      expect.objectContaining({
        series: [
          expect.objectContaining({
            type: 'pie',
            name: 'Issues',
            data: [
              {name: 'Resolved', value: 70},
              {name: 'Unresolved', value: 30},
            ],
          }),
        ],
        xAxis: null,
        yAxis: null,
      })
    );
    const tooltipFormatter = props.tooltip?.formatter as
      | ((params: {name: string; value: number}) => string)
      | undefined;
    expect(
      tooltipFormatter?.({name: '<img src=x onerror=alert(1)>', value: 70})
    ).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it.each(['not-a-timestamp', 1_785_405_600])(
    'does not render invalid time-axis value %s',
    value => {
      const raw = `{% chart %}${JSON.stringify({
        title: 'Error volume',
        x_axis: 'time',
        series: [{name: 'Errors', data: [{x: value, y: 12}]}],
      })}{% /chart %}`;

      render(<SeerMarkdown raw={raw} />);

      expect(screen.queryByTestId('seer-chart-embed')).not.toBeInTheDocument();
    }
  );

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

  it('escapes labels before rendering the HTML tooltip', () => {
    const unsafeLabel = '<img src=x onerror=alert(1)>';
    const unsafeSeriesName = '<svg onload=alert(2)>';
    const raw = `{% chart %}${JSON.stringify({
      title: 'Errors by browser',
      visualization: 'bar',
      x_axis: 'category',
      series: [{name: unsafeSeriesName, data: [{x: unsafeLabel, y: 12}]}],
    })}{% /chart %}`;

    render(<SeerMarkdown raw={raw} />);

    const tooltip = jest.mocked(BaseChart).mock.calls.at(-1)![0].tooltip;
    const formatAxisLabel = tooltip?.formatAxisLabel as
      | ((value: string) => string)
      | undefined;
    const nameFormatter = tooltip?.nameFormatter as
      | ((value: string) => string)
      | undefined;
    expect(formatAxisLabel?.(unsafeLabel)).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(nameFormatter?.(unsafeSeriesName)).toBe('&lt;svg onload=alert(2)&gt;');
  });
});
