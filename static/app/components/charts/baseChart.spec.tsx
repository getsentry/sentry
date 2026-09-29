import ReactEchartsCore from 'echarts-for-react/lib/core';
import {ThemeFixture} from 'sentry-fixture/theme';

import {render} from 'sentry-test/reactTestingLibrary';

import {BaseChart} from 'sentry/components/charts/baseChart';

const theme = ThemeFixture();

jest.mock('echarts-for-react/lib/core', () => {
  return jest.fn(() => null);
});

describe('BaseChart', () => {
  it('renders with grey dotted previous period when using only a single series', () => {
    render(
      <BaseChart
        colors={['#444674', '#d6567f', '#f2b712']}
        previousPeriod={[{seriesName: 'count()', data: [{value: 123, name: Date.now()}]}]}
      />
    );
    // @ts-expect-error TODO: Fix this type
    const series = ReactEchartsCore.mock.calls[0][0].option.series;
    expect(series).toHaveLength(1);
    expect(series[0].lineStyle.color).toEqual(theme.tokens.dataviz.semantic.neutral);
    expect(series[0].lineStyle.type).toBe('dotted');
  });

  it('renders with lightened colored dotted previous period when using multiple series', () => {
    render(
      <BaseChart
        colors={['#444674', '#d6567f', '#f2b712']}
        previousPeriod={[
          {seriesName: 'count()', data: [{value: 123, name: Date.now()}]},
          {
            seriesName: 'count_unique(user)',
            data: [{value: 123, name: Date.now()}],
          },
          {
            seriesName: 'failure_count()',
            data: [{value: 123, name: Date.now()}],
          },
        ]}
      />
    );
    const series =
      // @ts-expect-error TODO: Fix this type
      ReactEchartsCore.mock.calls[ReactEchartsCore.mock.calls.length - 1][0].option
        .series;
    expect(series).toHaveLength(3);
    expect(series[0].lineStyle.color).toBe('rgb(98, 100, 146)');
    expect(series[0].lineStyle.type).toBe('dotted');
    expect(series[1].lineStyle.color).toBe('rgb(244, 116, 157)');
    expect(series[1].lineStyle.type).toBe('dotted');
    expect(series[2].lineStyle.color).toBe('rgb(255, 213, 48)');
    expect(series[2].lineStyle.type).toBe('dotted');
  });

  describe('shouldSetOption', () => {
    function getLatestProps() {
      // @ts-expect-error TODO: Fix this type
      const calls = ReactEchartsCore.mock.calls;
      return calls[calls.length - 1][0];
    }

    function attachInstance(instance: {isDisposed: () => boolean} | undefined) {
      // Simulate echarts-for-react attaching itself to BaseChart's ref
      getLatestProps().ref({getEchartsInstance: () => instance});
    }

    it('skips updates when no echarts instance is attached to the DOM', () => {
      render(<BaseChart />);

      attachInstance(undefined);

      expect(getLatestProps().shouldSetOption()).toBe(false);
    });

    it('skips updates when the echarts instance is disposed', () => {
      render(<BaseChart />);

      attachInstance({isDisposed: () => true});

      expect(getLatestProps().shouldSetOption()).toBe(false);
    });

    it('allows updates when a live echarts instance is attached', () => {
      render(<BaseChart />);

      attachInstance({isDisposed: () => false});

      expect(getLatestProps().shouldSetOption()).toBe(true);
    });

    it('re-evaluates the instance state on every call', () => {
      render(<BaseChart />);
      const {shouldSetOption} = getLatestProps();

      attachInstance(undefined);
      expect(shouldSetOption()).toBe(false);

      let disposed = false;
      attachInstance({isDisposed: () => disposed});
      expect(shouldSetOption()).toBe(true);

      disposed = true;
      expect(shouldSetOption()).toBe(false);
    });

    it('re-evaluates across re-renders', () => {
      const {rerender} = render(<BaseChart height={100} />);
      attachInstance(undefined);
      expect(getLatestProps().shouldSetOption()).toBe(false);

      rerender(<BaseChart height={200} />);
      attachInstance({isDisposed: () => false});
      expect(getLatestProps().shouldSetOption()).toBe(true);
    });
  });
});
