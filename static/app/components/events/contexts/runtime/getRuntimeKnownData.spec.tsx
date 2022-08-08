import {getRuntimeKnownData} from 'sentry/components/events/contexts/runtime/getRuntimeKnownData';

import {runtimeMetaMockData, runtimeMockData} from './index.spec';

describe('getRuntimeKnownData', function () {
  it('filters data and transforms into the right way', function () {
    const runtimeKnownData = getRuntimeKnownData({
      data: runtimeMockData,
      meta: runtimeMetaMockData,
    });

    expect(runtimeKnownData).toEqual([
      {key: 'name', subject: 'Name', value: '', meta: runtimeMetaMockData.name['']},
      {
        key: 'version',
        subject: 'Version',
        value: '1.7.13(2.7.18 (default, Apr 20 2020, 19:34:11) \n[GCC 8.3.0])',
        meta: undefined,
      },
    ]);
  });
});
