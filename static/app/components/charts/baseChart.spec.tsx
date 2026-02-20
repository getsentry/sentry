import {ThemeFixture} from 'sentry-fixture/theme';

import {render} from 'sentry-test/reactTestingLibrary';

import type {BaseChartProps} from 'sentry/components/charts/baseChart';

const theme = ThemeFixture();
const {mockReactEchartsCore} = vi.hoisted(() => ({
  mockReactEchartsCore: vi.fn(() => null),
}));

vi.mock('echarts-for-react/lib/core', () => {
  return {default: mockReactEchartsCore};
});

describe('BaseChart', () => {
  beforeEach(() => {
    vi.resetModules();
    mockReactEchartsCore.mockClear();
  });

  async function renderBaseChart(props: BaseChartProps) {
    const {default: BaseChart} = await import('sentry/components/charts/baseChart');
    render(<BaseChart {...props} />);
  }

  it('renders with grey dotted previous period when using only a single series', async () => {
    await renderBaseChart({
      colors: ['#444674', '#d6567f', '#f2b712'],
      previousPeriod: [{seriesName: 'count()', data: [{value: 123, name: Date.now()}]}],
    });

    const lastCall = mockReactEchartsCore.mock.calls.at(-1);
    expect(lastCall).toBeDefined();

    // @ts-expect-error TODO: Fix this type
    const series = lastCall![0].option.series;
    expect(series).toHaveLength(1);
    expect(series[0].lineStyle.color).toEqual(theme.tokens.dataviz.semantic.neutral);
    expect(series[0].lineStyle.type).toBe('dotted');
  });

  it('renders with lightened colored dotted previous period when using multiple series', async () => {
    await renderBaseChart({
      colors: ['#444674', '#d6567f', '#f2b712'],
      previousPeriod: [
        {seriesName: 'count()', data: [{value: 123, name: Date.now()}]},
        {
          seriesName: 'count_unique(user)',
          data: [{value: 123, name: Date.now()}],
        },
        {
          seriesName: 'failure_count()',
          data: [{value: 123, name: Date.now()}],
        },
      ],
    });

    const lastCall = mockReactEchartsCore.mock.calls.at(-1);
    expect(lastCall).toBeDefined();

    // @ts-expect-error TODO: Fix this type
    const series = lastCall![0].option.series;
    expect(series).toHaveLength(3);
    expect(series[0].lineStyle.color).toBe('rgb(98, 100, 146)');
    expect(series[0].lineStyle.type).toBe('dotted');
    expect(series[1].lineStyle.color).toBe('rgb(244, 116, 157)');
    expect(series[1].lineStyle.type).toBe('dotted');
    expect(series[2].lineStyle.color).toBe('rgb(255, 213, 48)');
    expect(series[2].lineStyle.type).toBe('dotted');
  });
});
