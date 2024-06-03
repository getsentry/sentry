import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {WebVitalsDetailPanel} from 'sentry/views/performance/browser/webVitals/webVitalsDetailPanel';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');

describe('WebVitalsDetailPanel', function () {
  const organization = OrganizationFixture();
  let eventsMock, eventsStatsMock;

  beforeEach(function () {
    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {},
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });
    jest.mocked(usePageFilters).mockReturnValue({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      shouldPersist: true,
      selection: {
        datetime: {
          period: '10d',
          start: null,
          end: null,
          utc: false,
        },
        environments: [],
        projects: [],
      },
    });

    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [],
      },
    });
    eventsStatsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {},
    });
  });

  afterEach(function () {
    jest.resetAllMocks();
  });

  it('renders correctly with empty results', async () => {
    render(<WebVitalsDetailPanel onClose={() => undefined} webVital="lcp" />, {
      organization,
    });
    await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));
    // Once for project web vitals and once for samples
    expect(eventsMock).toHaveBeenCalledTimes(3);
    expect(eventsStatsMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Largest Contentful Paint (P75)')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(
      screen.getByText(/Largest Contentful Paint \(LCP\) measures the render/)
    ).toBeInTheDocument();
  });
});
