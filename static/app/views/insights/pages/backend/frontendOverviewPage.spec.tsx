import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import BackendOverviewPage from 'sentry/views/insights/pages/backend/backendOverviewPage';

jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useOrganization');
jest.mock('sentry/utils/useProjects');
jest.mock('sentry/views/insights/common/queries/useOnboardingProject');

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
  ProjectFixture({id: '1', platform: 'javascript-react'}),
  ProjectFixture({id: '2', platform: undefined}),
];

let mainTableApiCall: jest.Mock;

describe('Backend', () => {
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
      render(<BackendOverviewPage />);

      expect(await screen.findByRole('heading', {level: 1})).toHaveTextContent('Backend');
      expect(mainTableApiCall).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            query:
              'transaction:transaction-name ( ( !transaction.op:pageload !transaction.op:navigation !transaction.op:ui.render !transaction.op:interaction !transaction.op:ui.action.swipe !transaction.op:ui.action.scroll !transaction.op:ui.action.click !transaction.op:ui.action !transaction.op:ui.load !transaction.op:app.lifecycle !project.id:[1] ) OR ( transaction.op:http.server ) ) event.type:transaction',
          }),
        })
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
    match: [MockApiClient.matchQuery({referrer: 'api.performance.landing-table'})],
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

  jest.mocked(useOrganization).mockReturnValue(organization);
  jest.mocked(usePageFilters).mockReturnValue({
    isReady: true,
    desyncedFilters: new Set(),
    pinnedFilters: new Set(),
    shouldPersist: true,
    selection: pageFilterSelection,
  });
  jest.mocked(useProjects).mockReturnValue({
    projects,
    fetchError: null,
    hasMore: false,
    initiallyLoaded: true,
    onSearch: () => Promise.resolve(),
    reloadProjects: jest.fn(),
    placeholders: [],
    fetching: false,
  });
  jest.mocked(useOnboardingProject).mockReturnValue(undefined);
};
