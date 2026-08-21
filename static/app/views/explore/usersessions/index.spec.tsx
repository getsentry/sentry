import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';

import UserSessionsView from './index';

jest.mock('sentry/components/pageFilters/usePageFilters');

const A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const EPOCH_NANOS = 1704067200000 * 1e6;

function mockAttributes() {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/trace-items/attributes/',
    method: 'GET',
    body: [
      {
        key: 'span.op',
        name: 'span.op',
        attributeType: 'string',
        attributeSource: {source_type: 'sentry'},
      },
    ],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/tags/',
    method: 'GET',
    body: [],
  });
}

describe('UserSessionsView', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());
    mockAttributes();
  });

  it('renders the filter bar and a session row with per-dataset counts', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      method: 'GET',
      body: {
        data: [
          {
            'session.id': A,
            'count()': 5,
            'count_unique(trace)': 5,
            'count(session.id)': 5,
            'min(timestamp_precise)': EPOCH_NANOS,
            'max(timestamp_precise)': EPOCH_NANOS + 30 * 1e9,
            'min(precise.start_ts)': 1704067200,
            'max(precise.finish_ts)': 1704067230,
            'min(timestamp)': '2024-01-01T00:00:00+00:00',
            'max(timestamp)': '2024-01-01T00:00:30+00:00',
            'any(user.email)': 'lukas@example.com',
            'any(browser.name)': 'Chrome',
            'any(os.name)': 'macOS',
          },
        ],
        meta: {fields: {}},
      },
    });

    render(<UserSessionsView />, {organization});

    // The row is named by its user, not by its id — the short handle is what
    // stands in for the id.
    expect(await screen.findByText('lukas@example.com')).toBeInTheDocument();
    expect(screen.getByText('Chrome · macOS')).toBeInTheDocument();
    expect(screen.queryByText(A)).not.toBeInTheDocument();

    // The whole badge navigates to the detail page.
    expect(screen.getByRole('link', {name: /lukas@example.com/})).toHaveAttribute(
      'href',
      `/organizations/org-slug/explore/usersessions/${A}/`
    );
    expect(screen.getByText(A.slice(0, 8))).toBeInTheDocument();

    // Project, environment and date range filters are all present.
    expect(screen.getByTestId('page-filter-project-selector')).toBeInTheDocument();
    expect(screen.getByTestId('page-filter-environment-selector')).toBeInTheDocument();
    expect(screen.getByTestId('page-filter-timerange-selector')).toBeInTheDocument();
    expect(screen.getByTestId('search-query-builder')).toBeInTheDocument();

    // Column headers for each dataset.
    for (const header of ['Logs', 'Metrics', 'Traces', 'Errors', 'Duration']) {
      expect(screen.getByText(header)).toBeInTheDocument();
    }
  });

  it('renders an empty state when nothing carries a session id', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      method: 'GET',
      body: {data: [], meta: {fields: {}}},
    });

    render(<UserSessionsView />, {organization});

    expect(
      await screen.findByText(/Nothing in this time range carries a session.id/)
    ).toBeInTheDocument();
  });

  it('puts a submitted search into the URL', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      method: 'GET',
      body: {data: [], meta: {fields: {}}},
    });

    const {router} = render(<UserSessionsView />, {organization});

    await screen.findByText(/Nothing in this time range carries a session.id/);

    await userEvent.click(screen.getByRole('combobox', {name: 'Add a search term'}));
    await userEvent.paste('span.op:pageload');
    await userEvent.keyboard('{enter}');

    await waitFor(() => {
      expect(router.location.query.query).toBe('span.op:pageload');
    });
  });

  it('explains an empty result caused by an attribute no dataset knows', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      method: 'GET',
      body: {data: [], meta: {fields: {}}},
    });

    render(<UserSessionsView />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/usersessions/',
          query: {query: 'nonsense.key:1'},
        },
      },
    });

    expect(await screen.findByText('No sessions match this search.')).toBeInTheDocument();
    expect(
      await screen.findByText(
        'No telemetry in this time range has the attribute nonsense.key.'
      )
    ).toBeInTheDocument();
  });
});
