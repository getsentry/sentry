import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture, PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import ProjectsStore from 'sentry/stores/projectsStore';
import {useLocation} from 'sentry/utils/useLocation';
import BackendOverviewPage from 'sentry/views/insights/pages/backend/backendOverviewPage';

jest.mock('sentry/components/pageFilters/usePageFilters');
jest.mock('sentry/utils/useLocation');

let useLocationMock: jest.Mock;

const organization = OrganizationFixture({features: ['performance-view']});
const pageFilterSelection = PageFiltersFixture({
  projects: [1, 2],
  datetime: {
    period: '14d',
    start: null,
    end: null,
    utc: false,
  },
});
const projects = [
  ProjectFixture({id: '1', platform: 'javascript-react', firstTransactionEvent: true}),
  ProjectFixture({id: '2', platform: undefined, firstTransactionEvent: true}),
];

let mainTableApiCall: jest.Mock;

describe('BackendOverviewPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  describe('data fetching', () => {
    it('contains correct query with search', async () => {
      useLocationMock.mockClear();
      useLocationMock.mockReturnValue({
        pathname: '/insights/backend/http/',
        search: '',
        query: {
          statsPeriod: '10d',
          project: '1',
          query: 'transaction:transaction-name',
        },
        hash: '',
        state: undefined,
        action: 'PUSH',
        key: '',
      });
      render(<BackendOverviewPage />, {organization});

      await waitFor(() =>
        expect(mainTableApiCall).toHaveBeenCalledWith(
          '/organizations/org-slug/events/',
          expect.objectContaining({
            query: expect.objectContaining({
              query:
                'transaction:transaction-name ( ( !transaction.op:pageload !transaction.op:navigation !transaction.op:ui.render !transaction.op:interaction !transaction.op:ui.action.swipe !transaction.op:ui.action.scroll !transaction.op:ui.action.click !transaction.op:ui.action !transaction.op:ui.load !transaction.op:app.lifecycle !project.id:[1] ) OR ( transaction.op:http.server ) ) event.type:transaction',
            }),
          })
        )
      );
    });
  });
});

const setupMocks = () => {
  mainTableApiCall = MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    body: {
      data: [],
      meta: {
        fields: {
          'transaction.op': 'string',
          transaction: 'string',
          project: 'string',
          team_key_transaction: 'boolean',
          'p95(transaction.duration)': 'duration',
          'p75(transaction.duration)': 'duration',
          'tpm()': 'rate',
          'p50(transaction.duration)': 'duration',
          'user_misery()': 'number',
          'count_unique(user)': 'integer',
          'count_miserable(user)': 'integer',
        },
        units: {
          'transaction.op': null,
          transaction: null,
          project: null,
          team_key_transaction: null,
          'p95(transaction.duration)': 'millisecond',
          'p75(transaction.duration)': 'millisecond',
          'tpm()': '1/minute',
          'p50(transaction.duration)': 'millisecond',
          'user_misery()': null,
          'count_unique(user)': null,
          'count_miserable(user)': null,
        },
        isMetricsData: true,
        isMetricsExtractedData: false,
        tips: {},
        datasetReason: 'unchanged',
        dataset: 'metrics',
      },
    },
    match: [MockApiClient.matchQuery({referrer: 'api.insights.backend.landing-table'})],
  });
  mainTableApiCall = MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    body: {
      data: [],
    },
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events-stats/',
    body: {
      data: [],
      meta: {
        fields: {
          'transaction.op': 'string',
          transaction: 'string',
          project: 'string',
          team_key_transaction: 'boolean',
          'p95(transaction.duration)': 'duration',
          'p75(transaction.duration)': 'duration',
          'tpm()': 'rate',
          'p50(transaction.duration)': 'duration',
          'user_misery()': 'number',
          'count_unique(user)': 'integer',
          'count_miserable(user)': 'integer',
        },
        units: {
          'transaction.op': null,
          transaction: null,
          project: null,
          team_key_transaction: null,
          'p95(transaction.duration)': 'millisecond',
          'p75(transaction.duration)': 'millisecond',
          'tpm()': '1/minute',
          'p50(transaction.duration)': 'millisecond',
          'user_misery()': null,
          'count_unique(user)': null,
          'count_miserable(user)': null,
        },
        isMetricsData: true,
        isMetricsExtractedData: false,
        tips: {},
        datasetReason: 'unchanged',
        dataset: 'metrics',
      },
    },
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events-histogram/',
    body: {data: [], meta: []},
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/key-transactions-list/',
    body: [],
  });

  useLocationMock = jest.mocked(useLocation);
  useLocationMock.mockReturnValue({
    pathname: '/insights/backend/http/',
    search: '',
    query: {statsPeriod: '10d', 'span.domain': 'git', project: '1'},
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  });

  jest
    .mocked(usePageFilters)
    .mockReturnValue(PageFilterStateFixture({selection: pageFilterSelection}));
  ProjectsStore.loadInitialData(projects);
};
