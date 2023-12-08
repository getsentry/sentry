import {Event as EventFixture} from 'sentry-fixture/event';

import {appKnownDataValues} from 'sentry/components/events/contexts/app';
import {getAppKnownDataDetails} from 'sentry/components/events/contexts/app/getAppKnownDataDetails';

import {appMockData} from './index.spec';

describe('getAppKnownDataDetails', function () {
  it('returns values and according to the parameters', function () {
    const allKnownData: ReturnType<typeof getAppKnownDataDetails>[] = [];

    for (const type of Object.keys(appKnownDataValues)) {
      const appKnownDataDetails = getAppKnownDataDetails({
        type: appKnownDataValues[type],
        data: appMockData,
        event: EventFixture(),
      });

      if (!appKnownDataDetails) {
        continue;
      }

      allKnownData.push(appKnownDataDetails);
    }

    expect(allKnownData).toEqual([
      {subject: 'ID', value: '3145EA1A-0EAE-3F8C-969A-13A01394D3EA'},
      {subject: 'Start Time', value: undefined},
      {
        subject: 'Device',
        value: '2421fae1ac9237a8131e74883e52b0f7034a143f',
      },
      {subject: 'Build ID', value: 'io.sentry.sample.iOS-Swift'},
      {subject: 'Build Name', value: ''},
      {subject: 'Version', value: '7.1.3'},
      {subject: 'App Build', value: '1'},
      {subject: 'In Foreground', value: false},
    ]);
  });
});
