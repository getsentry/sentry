import {GroupFixture} from 'sentry-fixture/group';

import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {FlagDetailsDrawerContent} from './flagDetailsDrawerContent';

const mockNavigate = jest.fn();
jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: () => mockNavigate,
}));

describe('FlagDetailsDrawerContent', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/flags/logs/',
      query: {flag: 'test-flag-key'},
      body: {
        data: [
          {
            id: '1',
            provider: 'test-provider',
            flag: 'test-flag-key',
            action: 'updated',
            createdAt: '2021-01-01T00:00:00Z',
          },
        ],
      },
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders a list of tag values', async () => {
    render(<FlagDetailsDrawerContent group={GroupFixture()} />);

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByText('Flag Name')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();

    // Displays dropdown menu
    await userEvent.hover(screen.getByText('test-flag-key'));
    expect(
      screen.getByRole('button', {name: 'Flag Audit Log Actions Menu'})
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', {name: 'Flag Audit Log Actions Menu'})
    );
    expect(
      screen.getByRole('menuitemradio', {
        name: 'Search issues where this flag value is FALSE',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {
        name: 'Search issues where this flag value is TRUE',
      })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('menuitemradio', {name: 'Copy flag value to clipboard'})
    ).toBeInTheDocument();
  });

  it('renders an error message if flag values request fails', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/flags/logs/',
      statusCode: 500,
    });

    render(<FlagDetailsDrawerContent group={GroupFixture()} />);

    expect(
      await screen.findByText('There was an error loading feature flag details.')
    ).toBeInTheDocument();
  });

  it('renders an empty state message if audit log values are empty', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/flags/logs/',
      body: {data: []},
    });

    render(<FlagDetailsDrawerContent group={GroupFixture()} />);

    expect(
      await screen.findByText('No audit logs were found for this feature flag.')
    ).toBeInTheDocument();
  });
});
