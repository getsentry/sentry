import {browserHistory} from 'react-router';
import {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import localStorage from 'sentry/utils/localStorage';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useOnboardingProject} from 'sentry/views/performance/browser/webVitals/utils/useOnboardingProject';
import PageloadModule from 'sentry/views/starfish/modules/mobile/pageload';
import {PLATFORM_LOCAL_STORAGE_KEY} from 'sentry/views/starfish/views/screens/platformSelector';

jest.mock('sentry/utils/useOrganization');
jest.mock('sentry/views/performance/browser/webVitals/utils/useOnboardingProject');
jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useProjects');

describe('PageloadModule', function () {
  const project = ProjectFixture({platform: 'react-native'});
  const organization = OrganizationFixture({
    features: [
      'performance-screens-view',
      'mobile-ttid-ttfd-contribution',
      'performance-screens-platform-selector',
    ],
    projects: [project],
  });
  jest.mocked(useOrganization).mockReturnValue(organization);
  jest.mocked(useOnboardingProject).mockReturnValue(undefined);

  jest.mocked(useProjects).mockReturnValue({
    fetchError: null,
    fetching: false,
    hasMore: false,
    initiallyLoaded: false,
    onSearch: jest.fn(),
    placeholders: [],
    projects: [project],
  });

  jest.mocked(useLocation).mockReturnValue({
    action: 'PUSH',
    hash: '',
    key: '',
    pathname: '/organizations/org-slug/performance/mobile/screens/',
    query: {},
    search: '',
    state: undefined,
  } as Location);

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
      projects: [parseInt(project.id, 10)],
    },
  });

  let eventsMock;
  beforeEach(function () {
    localStorage.clear();
    browserHistory.push = jest.fn();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/`,
      body: [
        {
          id: 970136705,
          version: 'com.example.vu.android@2.10.5',
          dateCreated: '2023-12-19T21:37:53.895495Z',
        },
        {
          id: 969902997,
          version: 'com.example.vu.android@2.10.3+42',
          dateCreated: '2023-12-19T18:04:06.953025Z',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      query: {
        dataset: 'metrics',
        environment: [],
        field: ['release', 'count()'],
        per_page: 50,
        project: ['2'],
        query:
          'transaction.op:ui.load release:["com.example.vu.android@2.10.5","com.example.vu.android@2.10.3+42"]',
        referrer: 'api.starfish.mobile-release-selector',
        statsPeriod: '10d',
      },
      body: {
        meta: {},
        data: [
          {
            release: 'com.example.vu.android@2.10.5',
            'count()': 9768,
          },
          {
            release: 'com.example.vu.android@2.10.3+42',
            'count()': 826,
          },
        ],
      },
    });
    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('defaults requests with android platform filter', async function () {
    render(<PageloadModule />, {organization});

    await waitFor(() => {
      expect(
        screen.getByRole('radiogroup', {name: 'Filter platform'})
      ).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(eventsMock).toHaveBeenNthCalledWith(
        3,
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'event.type:transaction transaction.op:ui.load os.name:Android',
          }),
        })
      );
    });

    await waitFor(() => {
      expect(eventsMock).toHaveBeenNthCalledWith(
        4,
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'event.type:transaction transaction.op:ui.load os.name:Android',
          }),
        })
      );
    });
  });

  it('uses value from local storage if available', async function () {
    localStorage.setItem(PLATFORM_LOCAL_STORAGE_KEY, 'iOS');

    render(<PageloadModule />, {organization});

    await waitFor(() => {
      expect(
        screen.getByRole('radiogroup', {name: 'Filter platform'})
      ).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(eventsMock).toHaveBeenNthCalledWith(
        3,
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'event.type:transaction transaction.op:ui.load os.name:iOS',
          }),
        })
      );
    });
  });
});
