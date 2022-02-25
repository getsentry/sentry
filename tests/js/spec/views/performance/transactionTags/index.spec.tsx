import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  mountWithTheme,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import TransactionTags from 'sentry/views/performance/transactionSummary/transactionTags';

const TEST_RELEASE_NAME = 'test-project@1.0.0';

function initializeData({query} = {query: {}}) {
  const features = ['discover-basic', 'performance-view'];

  const organization = TestStubs.Organization({
    features,
    projects: [TestStubs.Project()],
  });

  const initialData = initializeOrg({
    ...initializeOrg(),
    organization,
    router: {
      location: {
        query: {
          transaction: 'Test Transaction',
          project: '1',
          ...query,
        },
      },
    },
  });

  act(() => ProjectsStore.loadInitialData(initialData.organization.projects));

  return initialData;
}

describe('Performance > Transaction Tags', function () {
  let histogramMock: Record<string, any>;

  beforeEach(function () {
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
      url: '/prompts-activity/',
      body: {},
    });
  });

  afterEach(function () {
    histogramMock.mockReset();
    MockApiClient.clearMockResponses();
    act(() => ProjectsStore.reset());
  });

  it('renders basic UI elements', async function () {
    const {organization, router, routerContext} = initializeData();

    mountWithTheme(<TransactionTags location={router.location} />, {
      context: routerContext,
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

    expect(browserHistory.replace).toHaveBeenCalledWith({
      query: {
        project: '1',
        statsPeriod: '14d',
        tagKey: 'hardwareConcurrency',
        transaction: 'Test Transaction',
      },
    });

    expect(screen.getByRole('radio', {name: 'hardwareConcurrency'})).toBeChecked();
  });

  it('Default tagKey is set when loading the page without one', async function () {
    const {organization, router, routerContext} = initializeData();

    mountWithTheme(<TransactionTags location={router.location} />, {
      context: routerContext,
      organization,
    });

    await waitFor(() => {
      // Table is loaded.
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    expect(browserHistory.replace).toHaveBeenCalledWith({
      query: {
        project: '1',
        statsPeriod: '14d',
        tagKey: 'hardwareConcurrency',
        transaction: 'Test Transaction',
      },
    });

    expect(histogramMock).toHaveBeenCalledTimes(1);
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
    const {organization, router, routerContext} = initializeData({
      query: {tagKey: 'effectiveConnectionType'},
    });

    mountWithTheme(<TransactionTags location={router.location} />, {
      context: routerContext,
      organization,
    });

    await waitFor(() => {
      // Table is loaded.
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    expect(browserHistory.replace).toHaveBeenCalledWith({
      query: {
        project: '1',
        statsPeriod: '14d',
        tagKey: 'effectiveConnectionType',
        transaction: 'Test Transaction',
      },
    });

    expect(histogramMock).toHaveBeenCalledTimes(1);
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

    mountWithTheme(<TransactionTags location={initialData.router.location} />, {
      context: initialData.routerContext,
      organization: initialData.organization,
    });

    await waitFor(() => {
      // Table is loaded.
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    // Release link is properly setup
    expect(screen.getByText(TEST_RELEASE_NAME)).toBeInTheDocument();
    expect(screen.getByText(TEST_RELEASE_NAME).parentElement).toHaveAttribute(
      'href',
      `/organizations/${initialData.organization.slug}/releases/${encodeURIComponent(
        TEST_RELEASE_NAME
      )}?project=${initialData.router.location.query.project}`
    );
  });

  it('clears tableCursor when selecting a new tag', async function () {
    const {organization, router, routerContext} = initializeData({
      query: {
        statsPeriod: '14d',
        tagKey: 'hardwareConcurrency',
      },
    });

    mountWithTheme(<TransactionTags location={router.location} />, {
      context: routerContext,
      organization,
    });

    expect(await screen.findByText('Suspect Tags')).toBeInTheDocument();

    expect(browserHistory.replace).toHaveBeenCalledWith({
      query: {
        project: '1',
        statsPeriod: '14d',
        tagKey: 'hardwareConcurrency',
        transaction: 'Test Transaction',
      },
    });

    expect(screen.getByRole('radio', {name: 'hardwareConcurrency'})).toBeChecked();
    expect(screen.getByRole('button', {name: 'Next'})).toHaveAttribute(
      'aria-disabled',
      'false'
    );

    // Paginate the table
    userEvent.click(screen.getByLabelText('Next'));

    await waitFor(() =>
      expect(browserHistory.push).toHaveBeenCalledWith({
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
    userEvent.click(screen.getByRole('radio', {name: 'effectiveConnectionType'}));

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
