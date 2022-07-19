import {render, screen} from 'sentry-test/reactTestingLibrary';

import SessionHistory from 'sentry/views/settings/account/accountSecurity/sessionHistory';

const ENDPOINT = '/users/me/ips/';

describe('AccountSecuritySessionHistory', function () {
  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders an ip address', function () {
    MockApiClient.addMockResponse({
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

    render(<SessionHistory />, {context: TestStubs.routerContext()});

    expect(screen.getByText('127.0.0.1')).toBeInTheDocument();
    expect(screen.getByText('192.168.0.1')).toBeInTheDocument();
    expect(screen.getByText('US (CA)')).toBeInTheDocument();
  });
});
