import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';

import UserSessionsView from './index';

jest.mock('sentry/components/pageFilters/usePageFilters');

const A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const EPOCH_NANOS = 1704067200000 * 1e6;

describe('UserSessionsView', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());
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
            'count(session.id)': 5,
            'min(timestamp_precise)': EPOCH_NANOS,
            'max(timestamp_precise)': EPOCH_NANOS + 30 * 1e9,
            'min(precise.start_ts)': 1704067200,
            'max(precise.finish_ts)': 1704067230,
            'min(timestamp)': '2024-01-01T00:00:00+00:00',
            'max(timestamp)': '2024-01-01T00:00:30+00:00',
          },
        ],
        meta: {fields: {}},
      },
    });

    render(<UserSessionsView />, {organization});

    expect(await screen.findByText(A)).toBeInTheDocument();

    // The session id navigates to its detail page.
    expect(screen.getByRole('link', {name: A})).toHaveAttribute(
      'href',
      `/organizations/org-slug/explore/usersessions/${A}/`
    );

    // Project, environment and date range filters are all present.
    expect(screen.getByTestId('page-filter-project-selector')).toBeInTheDocument();
    expect(screen.getByTestId('page-filter-environment-selector')).toBeInTheDocument();
    expect(screen.getByTestId('page-filter-timerange-selector')).toBeInTheDocument();

    // Column headers for each dataset.
    for (const header of ['Logs', 'Metrics', 'Spans', 'Errors', 'Duration']) {
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
});
