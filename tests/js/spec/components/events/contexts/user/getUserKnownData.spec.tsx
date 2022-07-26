import {getUserKnownData} from 'sentry/components/events/contexts/user/getUserKnownData';

import {userMetaMockData, userMockData} from './index.spec';

describe('getUserKnownData', function () {
  it('filters data and transforms into the right way', function () {
    const userKnownData = getUserKnownData({
      data: userMockData,
      meta: userMetaMockData,
    });

    expect(userKnownData).toEqual([
      {
        key: 'id',
        subject: 'ID',
        value: '',
        meta: userMetaMockData.id[''],
        subjectDataTestId: 'user-context-id-value',
      },
      {
        key: 'ip_address',
        subject: 'IP Address',
        value: null,
        meta: userMetaMockData.ip_address[''],
        subjectDataTestId: 'user-context-ip_address-value',
      },
    ]);
  });
});
