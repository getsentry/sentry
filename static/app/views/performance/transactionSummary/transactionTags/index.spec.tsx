import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import ProjectsStore from 'sentry/stores/projectsStore';
import {browserHistory} from 'sentry/utils/browserHistory';
import {useLocation} from 'sentry/utils/useLocation';
import TransactionTags from 'sentry/views/performance/transactionSummary/transactionTags';

const TEST_RELEASE_NAME = 'test-project@1.0.0';

jest.mock('sentry/utils/useLocation');

const mockUseLocation = jest.mocked(useLocation);

function initializeData({query} = {query: {}}) {
  const features = ['discover-basic', 'performance-view'];

  const organization = OrganizationFixture({
    features,
  });

  const newQuery = {
    transaction: 'Test Transaction',
    project: '1',
    ...query,
  };

  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: newQuery,
      },
    },
  });

  mockUseLocation.mockReturnValue({
    pathname: '/organizations/org-slug/performance/summary/tags/',
    query: newQuery,
  } as any); // TODO - type this correctly

  act(() => ProjectsStore.loadInitialData(initialData.projects));

  return initialData;
}

describe('Performance > Transaction Tags', function () {
  let histogramMock: Record<string, any>;

  beforeEach(function () {
    mockUseLocation.mockReturnValue(
      LocationFixture({pathname: '/organizations/org-slug/performance/summary/tags/'})
    );
    browserHistory.replace = jest.fn();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/user.email/values/',
      body: [],
    });

    const pageLinks =
      '<https://sentry.io/api/0/organizations/sentry/events-facets-performance/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
      '<https://sentry.io/api/0/organizations/sentry/events-facets-performance/?cursor=0:100:0>; rel="next"; results="true"; cursor="0:20:0"';

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-facets-performance/',
      headers: {Link: pageLinks},
      body: {
        meta: {
          tags_key: 'string',
          tags_value: 'string',
          sumdelta: 'duration',
          count: 'integer',
          frequency: 'number',
          comparison: 'number',
          aggregate: 'number',
        },
        data: [
          {
            tags_key: 'hardwareConcurrency',
            tags_value: '4',
            sumdelta: 45773.0,
            count: 83,
            frequency: 0.05,
            comparison: 1.45,
            aggregate: 2000.5,
          },
          {
            tags_key: 'effectiveConnectionType',
            tags_value: '4g',
            sumdelta: 45773.0,
            count: 83,
            frequency: 0.05,
            comparison: 1.45,
            aggregate: 2000.5,
          },
          {
            tags_key: 'release',
            tags_value: TEST_RELEASE_NAME,
            sumdelta: 45773.0,
            count: 83,
            frequency: 0.05,
            comparison: 1.45,
            aggregate: 2000.5,
          },
        ],
      },
    });
    histogramMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-facets-performance-histogram/',
      body: {
        meta: {
          count: 'integer',
          histogram_measurements_lcp_120_360_1: 'number',
          tags_key: 'string',
          tags_value: 'string',
        },
        data: [
          {
            histogram_measurements_lcp_120_360_1: 600,
            tags_value: '4',
            tags_key: 'hardwareConcurrency',
            count: 3,
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: false},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replay-count/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
  });

  afterEach(function () {
    histogramMock.mockReset();
    MockApiClient.clearMockResponses();
    act(() => ProjectsStore.reset());
  });

  it('renders basic UI elements', async function () {
    const {organization, router} = initializeData();

    render(<TransactionTags location={router.location} />, {
      router,
      organization,
    });

    // It shows the sidebar
    expect(await screen.findByText('Suspect Tags')).toBeInTheDocument();

    // It shows the header
    expect(screen.getByRole('heading', {name: 'Test Transaction'})).toBeInTheDocument();

    // It shows a table
    expect(screen.getByRole('table')).toBeInTheDocument();

    // It shows the tag chart
    expect(screen.getByText('Heat Map')).toBeInTheDocument();

    await waitFor(() => {
      expect(browserHistory.replace).toHaveBeenCalledWith({
        query: {
          project: '1',
          statsPeriod: '14d',
          tagKey: 'hardwareConcurrency',
          transaction: 'Test Transaction',
        },
      });
    });

    expect(await screen.findByRole('radio', {name: 'hardwareConcurrency'})).toBeChecked();
  });

  it('Default tagKey is set when loading the page without one', async function () {
    const {organization, router} = initializeData();

    render(<TransactionTags location={router.location} />, {
      router,
      organization,
    });

    await waitFor(() => {
      // Table is loaded.
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(browserHistory.replace).toHaveBeenCalledWith({
        query: {
          project: '1',
          statsPeriod: '14d',
          tagKey: 'hardwareConcurrency',
          transaction: 'Test Transaction',
        },
      });
    });

    await waitFor(() => expect(histogramMock).toHaveBeenCalledTimes(1));
    expect(histogramMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          statsPeriod: '14d',
          tagKey: 'hardwareConcurrency',
        }),
      })
    );
  });

  it('Passed tagKey gets used when calling queries', async function () {
    const {organization, router} = initializeData({
      query: {tagKey: 'effectiveConnectionType'},
    });

    render(<TransactionTags location={router.location} />, {
      router,
      organization,
    });

    await waitFor(() => {
      // Table is loaded.
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(browserHistory.replace).toHaveBeenCalledWith({
        query: {
          project: '1',
          statsPeriod: '14d',
          tagKey: 'effectiveConnectionType',
          transaction: 'Test Transaction',
        },
      });
    });

    await waitFor(() => expect(histogramMock).toHaveBeenCalledTimes(1));
    expect(histogramMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          statsPeriod: '14d',
          tagKey: 'effectiveConnectionType',
        }),
      })
    );
  });

  it('creates links to releases if the release tag is selected', async () => {
    const initialData = initializeData({query: {tagKey: 'release'}});

    render(<TransactionTags location={initialData.router.location} />, {
      router: initialData.router,
      organization: initialData.organization,
    });

    await waitFor(() => {
      // Table is loaded.
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    // Release link is properly setup
    expect(await screen.findByText(TEST_RELEASE_NAME)).toBeInTheDocument();
    expect(screen.getByText(TEST_RELEASE_NAME).parentElement).toHaveAttribute(
      'href',
      `/organizations/${initialData.organization.slug}/releases/${encodeURIComponent(
        TEST_RELEASE_NAME
      )}?project=${initialData.router.location.query.project}`
    );
  });

  it('clears tableCursor when selecting a new tag', async function () {
    const {organization, router} = initializeData({
      query: {
        statsPeriod: '14d',
        tagKey: 'hardwareConcurrency',
      },
    });

    render(<TransactionTags location={router.location} />, {
      router,
      organization,
    });

    expect(await screen.findByText('Suspect Tags')).toBeInTheDocument();

    await waitFor(() => {
      expect(browserHistory.replace).toHaveBeenCalledWith({
        query: {
          project: '1',
          statsPeriod: '14d',
          tagKey: 'hardwareConcurrency',
          transaction: 'Test Transaction',
        },
      });
    });

    expect(await screen.findByRole('radio', {name: 'hardwareConcurrency'})).toBeChecked();
    expect(await screen.findByRole('button', {name: 'Next'})).toHaveAttribute(
      'aria-disabled',
      'false'
    );

    // Paginate the table
    await userEvent.click(screen.getByLabelText('Next'));

    await waitFor(() =>
      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/performance/summary/tags/',
        query: {
          project: '1',
          statsPeriod: '14d',
          tagKey: 'hardwareConcurrency',
          transaction: 'Test Transaction',
          tableCursor: '0:20:0',
        },
      })
    );

    // Choose a different tag
    await userEvent.click(screen.getByRole('radio', {name: 'effectiveConnectionType'}));

    await waitFor(() => {
      expect(browserHistory.replace).toHaveBeenCalledWith({
        query: {
          project: '1',
          statsPeriod: '14d',
          tagKey: 'effectiveConnectionType',
          transaction: 'Test Transaction',
        },
      });
    });
  });

  it('changes the aggregate column when a new x-axis is selected', async function () {
    const {organization, router} = initializeData({
      query: {tagKey: 'os'},
    });

    render(<TransactionTags location={router.location} />, {
      router,
      organization,
    });

    await waitFor(() => {
      // Table is loaded.
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    await waitFor(() => expect(histogramMock).toHaveBeenCalledTimes(1));

    expect(histogramMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          aggregateColumn: 'transaction.duration',
        }),
      })
    );

    await selectEvent.select(screen.getByText('X-Axis'), 'LCP');

    expect(await screen.findByRole('table')).toBeInTheDocument();

    expect(histogramMock).toHaveBeenCalledTimes(2);

    expect(histogramMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          aggregateColumn: 'measurements.lcp',
        }),
      })
    );
  });
});
