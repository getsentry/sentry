import fetchMock from 'jest-fetch-mock';
import {ConfigFixture} from 'sentry-fixture/config';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {Layout} from 'admin/views/layout';

function renderLayout() {
  return render(<Layout />, {
    initialRouterConfig: {
      location: {pathname: '/_admin/'},
      route: '/_admin/*',
      children: [{path: '*', element: <div>Admin content</div>}],
    },
  });
}

describe('Layout superuser preflight check', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    ConfigStore.loadInitialData(ConfigFixture({user: UserFixture()}));
    // SuperuserStaffAccessForm calls /authenticators/ on mount
    MockApiClient.addMockResponse({
      url: '/authenticators/',
      body: [],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders outlet content when superuser check returns 200', async () => {
    fetchMock.mockResponse(req =>
      req.url.includes('superuser-check')
        ? Promise.resolve({body: '', status: 200})
        : Promise.resolve({body: '{}', status: 200})
    );

    renderLayout();

    expect(await screen.findByText('Admin content')).toBeInTheDocument();
  });

  it('renders re-auth form instead of outlet when superuser check returns 403', async () => {
    fetchMock.mockResponse(req =>
      req.url.includes('superuser-check')
        ? Promise.resolve({body: '', status: 403})
        : Promise.resolve({body: '{}', status: 200})
    );

    renderLayout();

    expect(await screen.findByRole('button', {name: 'Continue'})).toBeInTheDocument();
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });

  it('renders error state (not re-auth form) when superuser check returns a non-403 server error', async () => {
    fetchMock.mockResponse(req =>
      req.url.includes('superuser-check')
        ? Promise.resolve({body: '', status: 500})
        : Promise.resolve({body: '{}', status: 200})
    );

    renderLayout();

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Continue'})).not.toBeInTheDocument();
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });

  it('retries the superuser check when Retry is clicked after a server error', async () => {
    let superuserCheckCallCount = 0;
    fetchMock.mockResponse(req => {
      if (!req.url.includes('superuser-check')) {
        return Promise.resolve({body: '{}', status: 200});
      }
      superuserCheckCallCount++;
      return Promise.resolve({
        body: '',
        status: superuserCheckCallCount === 1 ? 500 : 200,
      });
    });

    renderLayout();

    await userEvent.click(await screen.findByRole('button', {name: 'Retry'}));

    expect(await screen.findByText('Admin content')).toBeInTheDocument();
    expect(
      screen.queryByText('There was an error loading data.')
    ).not.toBeInTheDocument();
  });
});
