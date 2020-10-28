import React from 'react';

import {mount} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import AccountSecuritySessionHistory from 'app/views/settings/account/accountSecurity/accountSecuritySessionHistory';

const ENDPOINT = '/users/me/ips/';
const ORG_ENDPOINT = '/organizations/';

describe('AccountSecuritySessionHistory', function () {
  beforeEach(function () {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: ORG_ENDPOINT,
      body: TestStubs.Organizations(),
    });
  });

  it('renders an ip address', async function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [
        {
          countryCode: null,
          regionCode: null,
          lastSeen: '2018-09-07T18:24:29.401Z',
          ipAddress: '127.0.0.1',
          id: '1',
          firstSeen: '2018-09-07T17:59:14.642Z',
        },
        {
          countryCode: 'US',
          regionCode: 'CA',
          lastSeen: '2018-09-07T18:17:05.087Z',
          ipAddress: '192.168.0.1',
          id: '3',
          firstSeen: '2018-09-07T18:17:05.087Z',
        },
      ],
    });

    const wrapper = mount(<AccountSecuritySessionHistory />, TestStubs.routerContext());

    wrapper.update();
    await tick();
    expect(wrapper.find('SessionRow')).toHaveLength(2);
  });
});
