import {enzymeRender} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import BaseChart from 'sentry/components/charts/baseChart';
import theme from 'sentry/utils/theme';

describe('BaseChart', function () {
  const {routerContext} = initializeOrg();

  it('renders with grey dotted previous period when using only a single series', function () {
    const wrapper = enzymeRender(
      <BaseChart
        colors={['#444674', '#d6567f', '#f2b712']}
        previousPeriod={[
          {seriesName: 'count()', data: [{value: 123, name: new Date().getTime()}]},
        ]}
      />,
      routerContext
    );
    const series = wrapper.find('ChartContainer').props().children.props.option.series;
    expect(series.length).toEqual(1);
    expect(series[0].lineStyle.color).toEqual(theme.gray200);
    expect(series[0].lineStyle.type).toEqual('dotted');
  });

  it('renders with lightened colored dotted previous period when using multiple series', function () {
    const wrapper = enzymeRender(
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
      />,
      routerContext
    );
    const series = wrapper.find('ChartContainer').props().children.props.option.series;
    expect(series.length).toEqual(3);
    expect(series[0].lineStyle.color).toEqual('rgb(98, 100, 146)');
    expect(series[0].lineStyle.type).toEqual('dotted');
    expect(series[1].lineStyle.color).toEqual('rgb(244, 116, 157)');
    expect(series[1].lineStyle.type).toEqual('dotted');
    expect(series[2].lineStyle.color).toEqual('rgb(255, 213, 48)');
    expect(series[2].lineStyle.type).toEqual('dotted');
  });
});
