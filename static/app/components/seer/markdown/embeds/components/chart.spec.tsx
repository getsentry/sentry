import {ThemeFixture} from 'sentry-fixture/theme';

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
              {x: '2026-07-30T14:00:00Z', y: 15},
              {x: '2026-07-30T12:00:00Z', y: 12},
              {x: '2026-07-30T13:00:00Z', y: 18},
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
      expect(props.start).toEqual(new Date('2026-07-30T12:00:00Z'));
      expect(props.end).toEqual(new Date('2026-07-30T14:00:00Z'));
      expect(props.showTimeInTooltip).toBe(true);
      expect(props.tooltip).toEqual(expect.objectContaining({trigger: 'axis'}));
      if (visualization === 'area') {
        expect(props.series?.[0]).toHaveProperty('areaStyle');
      }
      if (visualization === 'bar') {
        expect(props.series?.[0]?.data).toEqual([
          expect.objectContaining({value: [Date.parse('2026-07-30T12:00:00Z'), 12]}),
          expect.objectContaining({value: [Date.parse('2026-07-30T13:00:00Z'), 18]}),
          expect.objectContaining({value: [Date.parse('2026-07-30T14:00:00Z'), 15]}),
        ]);
      } else {
        expect(props.series?.[0]?.data).toEqual([
          [Date.parse('2026-07-30T12:00:00Z'), 12],
          [Date.parse('2026-07-30T13:00:00Z'), 18],
          [Date.parse('2026-07-30T14:00:00Z'), 15],
        ]);
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

  it('uses one duration unit across the y axis', () => {
    const raw = `{% chart %}${JSON.stringify({
      title: 'Latency',
      visualization: 'line',
      x_axis: 'category',
      y_axis_unit: 'duration',
      series: [
        {
          name: 'p95',
          data: [
            {x: 'Chrome', y: 500},
            {x: 'Safari', y: 1000},
          ],
        },
      ],
    })}{% /chart %}`;

    render(<SeerMarkdown raw={raw} />);

    const formatter = jest.mocked(BaseChart).mock.calls.at(-1)![0].yAxis?.axisLabel
      ?.formatter as ((value: number) => string) | undefined;
    expect(formatter?.(500)).toBe('500ms');
    expect(formatter?.(1000)).toBe('1000ms');
  });

  it('normalizes numeric category values to strings', () => {
    const raw = `{% chart %}${JSON.stringify({
      title: 'Errors by status',
      visualization: 'line',
      x_axis: 'category',
      series: [
        {
          name: 'Errors',
          data: [
            {x: 200, y: 12},
            {x: 500, y: 4},
          ],
        },
      ],
    })}{% /chart %}`;

    render(<SeerMarkdown raw={raw} />);

    expect(jest.mocked(BaseChart).mock.calls.at(-1)![0].series?.[0]?.data).toEqual([
      ['200', 12],
      ['500', 4],
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
              [0, 0, 120],
              [1, 0, 480],
              [0, 1, 150],
              [1, 1, 520],
            ],
          }),
        ],
        visualMap: expect.objectContaining({min: 0, max: 520}),
        xAxis: expect.objectContaining({
          type: 'category',
          data: [Date.parse('2026-07-30T12:00:00Z'), Date.parse('2026-07-31T12:00:00Z')],
          axisLabel: expect.objectContaining({showMaxLabel: true, showMinLabel: true}),
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
    const tooltip = tooltipFormatter?.({value: [0, 0, 120]});
    expect(tooltip).toContain('<strong>Chrome</strong>');
    expect(tooltip).toContain('tooltip-series-solo');
    expect(tooltip).toContain('tooltip-arrow');
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
            {x: 'Unresolved', y: 20},
            {x: 'Ignored', y: 10},
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
              {name: 'Unresolved', value: 20},
              {name: 'Ignored', value: 10},
            ],
          }),
        ],
        xAxis: null,
        yAxis: null,
      })
    );
    const colors = props.colors;
    expect(colors).toEqual(expect.any(Function));
    expect(typeof colors === 'function' ? colors(ThemeFixture()) : undefined).toEqual(
      ThemeFixture().chart.getColorPalette(2)
    );
    const tooltipFormatter = props.tooltip?.formatter as
      | ((params: {name: string; value: number}) => string)
      | undefined;
    const tooltip = tooltipFormatter?.({
      name: '<img src=x onerror=alert(1)>',
      value: 70,
    });
    expect(tooltip).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(tooltip).toContain('tooltip-series-solo');
    expect(tooltip).toContain('tooltip-arrow');
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

  it('escapes category labels before rendering the HTML tooltip', () => {
    const unsafeLabel = '<img src=x onerror=alert(1)>';
    const raw = `{% chart %}${JSON.stringify({
      title: 'Errors by browser',
      visualization: 'bar',
      x_axis: 'category',
      series: [{name: 'Errors', data: [{x: unsafeLabel, y: 12}]}],
    })}{% /chart %}`;

    render(<SeerMarkdown raw={raw} />);

    const tooltip = jest.mocked(BaseChart).mock.calls.at(-1)![0].tooltip;
    const formatAxisLabel = tooltip?.formatAxisLabel as
      | ((value: string) => string)
      | undefined;
    expect(formatAxisLabel?.(unsafeLabel)).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(jest.mocked(BaseChart).mock.calls.at(-1)![0].xAxis).toEqual(
      expect.objectContaining({
        axisLabel: expect.objectContaining({showMaxLabel: true, showMinLabel: true}),
      })
    );
  });
});
