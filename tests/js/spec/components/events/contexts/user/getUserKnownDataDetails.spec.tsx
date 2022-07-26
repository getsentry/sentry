import {userKnownDataValues} from 'sentry/components/events/contexts/user';
import {getUserKnownDataDetails} from 'sentry/components/events/contexts/user/getUserKnownDataDetails';

import {userMockData} from './index.spec';

describe('getUserKnownDataDetails', function () {
  it('returns values and according to the parameters', function () {
    const allKnownData: ReturnType<typeof getUserKnownDataDetails>[] = [];

    for (const type of Object.keys(userKnownDataValues)) {
      const userKnownData = getUserKnownDataDetails({
        type: userKnownDataValues[type],
        data: userMockData,
      });

      if (!userKnownData) {
        continue;
      }

      allKnownData.push(userKnownData);
    }

    expect(allKnownData).toEqual([
      {
        subject: 'ID',
        value: '',
      },
      {
        subject: 'Email',
        subjectIcon: false,
        value: null,
      },
      {
        subject: 'Username',
        value: null,
      },
      {
        subject: 'IP Address',
        value: null,
      },
      {
        subject: 'Name',
        value: null,
      },
    ]);
  });
});
