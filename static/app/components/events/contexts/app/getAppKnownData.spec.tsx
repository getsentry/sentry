import {getAppKnownData} from 'sentry/components/events/contexts/app/getAppKnownData';

import {appMetaMockData, appMockData} from './index.spec';

describe('getAppKnownData', function () {
  it('filters data and transforms into the right way', function () {
    const appKnownData = getAppKnownData({
      data: appMockData,
      meta: appMetaMockData,
      event: TestStubs.Event(),
    });

    expect(appKnownData).toEqual([
      {
        key: 'app_id',
        subject: 'ID',
        value: '3145EA1A-0EAE-3F8C-969A-13A01394D3EA',
        meta: undefined,
      },
      {
        key: 'device_app_hash',
        subject: 'Device',
        value: '2421fae1ac9237a8131e74883e52b0f7034a143f',
        meta: undefined,
      },
      {
        key: 'app_identifier',
        subject: 'Build ID',
        value: 'io.sentry.sample.iOS-Swift',
        meta: undefined,
      },
      {
        key: 'app_name',
        subject: 'Build Name',
        value: '',
        meta: appMetaMockData.app_name[''],
      },
      {
        key: 'app_version',
        subject: 'Version',
        value: '7.1.3',
        meta: undefined,
      },
      {
        key: 'app_build',
        subject: 'App Build',
        value: '1',
        meta: undefined,
      },
    ]);
  });
});
