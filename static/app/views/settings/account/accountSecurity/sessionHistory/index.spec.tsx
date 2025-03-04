import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {isDemoModeEnabled} from 'sentry/utils/demoMode';
import SessionHistory from 'sentry/views/settings/account/accountSecurity/sessionHistory';

const ENDPOINT = '/users/me/ips/';

jest.mock('sentry/utils/demoMode');

describe('AccountSecuritySessionHistory', function () {
  const {routerProps} = initializeOrg();

  beforeEach(function () {
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
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders an ip address', async function () {
    render(<SessionHistory {...routerProps} />);

    expect(await screen.findByText('127.0.0.1')).toBeInTheDocument();
    expect(screen.getByText('192.168.0.1')).toBeInTheDocument();
    expect(screen.getByText('US (CA)')).toBeInTheDocument();
  });

  it('renders empty in demo mode even if ips exist', async () => {
    (isDemoModeEnabled as jest.Mock).mockReturnValue(true);

    await render(<SessionHistory {...routerProps} />);

    expect(screen.queryByText('127.0.0.1')).not.toBeInTheDocument();
    expect(screen.queryByText('192.168.0.1')).not.toBeInTheDocument();
    expect(screen.queryByText('US (CA)')).not.toBeInTheDocument();

    (isDemoModeEnabled as jest.Mock).mockReset();
  });
});
