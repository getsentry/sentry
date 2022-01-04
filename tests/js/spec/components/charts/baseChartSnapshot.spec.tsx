import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import BaseChart from 'sentry/components/charts/baseChart';

describe('BaseChart', function () {
  const {routerContext} = initializeOrg();
  it('renders with default height when not provided autoHeightResize', async () => {
    const wrapper = mountWithTheme(
      <div style={{height: '500px', background: 'yellow'}}>
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
      </div>,
      routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper).toSnapshot();
  });

  it('can scale to full parent height when given autoHeightResize', async () => {
    const wrapper = mountWithTheme(
      <div style={{height: '500px', background: 'yellow'}}>
        <BaseChart
          autoHeightResize
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
      </div>,
      routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper).toSnapshot();
  });
});
