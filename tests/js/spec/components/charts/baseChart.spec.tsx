import ReactEchartsCore from 'echarts-for-react/lib/core';

import {render} from 'sentry-test/reactTestingLibrary';

import BaseChart from 'sentry/components/charts/baseChart';
import theme from 'sentry/utils/theme';

jest.mock('echarts-for-react/lib/core', () => {
  return jest.fn(() => null);
});

describe('BaseChart', function () {
  it('renders with grey dotted previous period when using only a single series', function () {
    render(
      <BaseChart
        colors={['#444674', '#d6567f', '#f2b712']}
        previousPeriod={[
          {seriesName: 'count()', data: [{value: 123, name: new Date().getTime()}]},
        ]}
      />
    );
    // @ts-expect-error
    const series = ReactEchartsCore.mock.calls[0][0].option.series;
    expect(series.length).toEqual(1);
    expect(series[0].lineStyle.color).toEqual(theme.gray200);
    expect(series[0].lineStyle.type).toEqual('dotted');
  });

  it('renders with lightened colored dotted previous period when using multiple series', function () {
    render(
      <BaseChart
        colors={['#444674', '#d6567f', '#f2b712']}
        previousPeriod={[
          {seriesName: 'count()', data: [{value: 123, name: new Date().getTime()}]},
          {
            seriesName: 'count_unique(user)',
            data: [{value: 123, name: new Date().getTime()}],
          },
          {
            seriesName: 'failure_count()',
            data: [{value: 123, name: new Date().getTime()}],
          },
        ]}
      />
    );
    const series =
      // @ts-expect-error
      ReactEchartsCore.mock.calls[ReactEchartsCore.mock.calls.length - 1][0].option
        .series;
    expect(series.length).toEqual(3);
    expect(series[0].lineStyle.color).toEqual('rgb(98, 100, 146)');
    expect(series[0].lineStyle.type).toEqual('dotted');
    expect(series[1].lineStyle.color).toEqual('rgb(244, 116, 157)');
    expect(series[1].lineStyle.type).toEqual('dotted');
    expect(series[2].lineStyle.color).toEqual('rgb(255, 213, 48)');
    expect(series[2].lineStyle.type).toEqual('dotted');
  });
});
