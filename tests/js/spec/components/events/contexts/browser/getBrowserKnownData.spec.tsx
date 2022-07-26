import {getBrowserKnownData} from 'sentry/components/events/contexts/browser/getBrowserKnownData';

import {browserMetaMockData, browserMockData} from './index.spec';

describe('getBrowserKnownData', function () {
  it('filters data and transforms into the right way', function () {
    const browserKnownData = getBrowserKnownData({
      data: browserMockData,
      meta: browserMetaMockData,
    });

    expect(browserKnownData).toEqual([
      {key: 'name', subject: 'Name', value: '', meta: browserMetaMockData.name['']},
      {
        key: 'version',
        subject: 'Version',
        value: '83.0.4103',
        meta: undefined,
      },
    ]);
  });
});
