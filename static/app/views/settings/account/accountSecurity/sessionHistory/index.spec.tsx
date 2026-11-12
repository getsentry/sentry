import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {isDemoModeActive} from 'sentry/utils/demoMode';
import SessionHistory from 'sentry/views/settings/account/accountSecurity/sessionHistory';

const ENDPOINT = '/users/me/ips/';

jest.mock('sentry/utils/demoMode');

describe('AccountSecuritySessionHistory', () => {
  beforeEach(() => {
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

  it('renders a row for each session under the column headers', async () => {
    render(<SessionHistory />);

    const table = screen.getByRole('table', {name: 'Session History'});
    const locatedRow = await within(table).findByRole('row', {name: /192\.168\.0\.1/});

    expect(
      within(table)
        .getAllByRole('columnheader')
        .map(header => header.textContent)
    ).toEqual(['Sessions', 'First Seen', 'Last Seen']);
    expect(within(table).getByRole('row', {name: /127\.0\.0\.1/})).toBeInTheDocument();
    expect(within(locatedRow).getByText('US (CA)')).toBeInTheDocument();
    expect(within(locatedRow).getAllByRole('cell')).toHaveLength(3);
  });

  it('renders an error when the request fails', async () => {
    MockApiClient.addMockResponse({url: ENDPOINT, statusCode: 500});

    render(<SessionHistory />);

    expect(await screen.findByRole('button', {name: 'Retry'})).toBeInTheDocument();
    expect(screen.getByRole('table', {name: 'Session History'})).toBeInTheDocument();
  });

  it('renders empty in demo mode even if ips exist', () => {
    jest.mocked(isDemoModeActive).mockReturnValue(true);

    render(<SessionHistory />);

    expect(screen.getByText('No sessions found')).toBeInTheDocument();
    expect(screen.queryByText('127.0.0.1')).not.toBeInTheDocument();
    expect(screen.queryByText('192.168.0.1')).not.toBeInTheDocument();
    expect(screen.queryByText('US (CA)')).not.toBeInTheDocument();

    jest.mocked(isDemoModeActive).mockReset();
  });
});
