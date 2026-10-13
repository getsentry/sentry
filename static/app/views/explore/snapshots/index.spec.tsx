import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import SnapshotsList from 'sentry/views/explore/snapshots';

jest.mock('sentry/utils/analytics');

describe('SnapshotsList', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({id: '3', slug: 'ios-app', platform: 'apple-ios'});

  let buildsMock: jest.Mock;

  beforeEach(() => {
    act(() => ProjectsStore.loadInitialData([project]));
    act(() =>
      PageFiltersStore.onInitializeUrlState({
        projects: [Number(project.id)],
        environments: [],
        datetime: {period: '14d', utc: null, start: null, end: null},
      })
    );

    buildsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/builds/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      body: [],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders the snapshot list with the snapshot display', async () => {
    render(<SnapshotsList />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/explore/snapshots/`,
          query: {query: 'app_id:com.example.app'},
        },
      },
    });

    expect(await screen.findByText(/No snapshots found/)).toBeInTheDocument();
    expect(buildsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/builds/`,
      expect.objectContaining({
        query: expect.objectContaining({
          display: 'snapshot',
          project: [project.id],
          query: 'app_id:com.example.app',
        }),
      })
    );
  });

  it('tracks list metadata with the snapshots page source', async () => {
    render(<SnapshotsList />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/explore/snapshots/`,
        },
      },
    });

    await waitFor(() =>
      expect(trackAnalytics).toHaveBeenCalledWith(
        'preprod.builds.list.metadata',
        expect.objectContaining({display: 'snapshot', page_source: 'snapshots_list'})
      )
    );
  });
});
