import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {PlatformCompatibilityChecker} from 'sentry/views/performance/platformCompatibilityChecker';

jest.mock('sentry/utils/useProjects');
jest.mock('sentry/utils/usePageFilters');

describe('PlatformCompatibilityChecker', () => {
  let organization;
  beforeEach(() => {
    MockApiClient.clearMockResponses();

    jest.mocked(useProjects).mockReturnValue({
      projects: [
        ProjectFixture({id: '1'}),
        ProjectFixture({id: '2', slug: 'incompatible'}),
      ],
      onSearch: jest.fn(),
      placeholders: [],
      fetching: false,
      hasMore: null,
      fetchError: null,
      initiallyLoaded: false,
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
        projects: [1],
      },
    });

    organization = OrganizationFixture();
  });

  it('renders the children if all projects are compatible', async () => {
    // Incompatible projects response
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [],
      },
    });

    render(
      <PlatformCompatibilityChecker
        compatibleSDKNames={['foobar']}
        docsUrl="www.example.com"
      >
        <div>Child</div>
      </PlatformCompatibilityChecker>
    );

    expect(await screen.findByText('Child')).toBeInTheDocument();
  });

  it('does not render the children if all selected projects are incompatible', async () => {
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
        projects: [2],
      },
    });

    // Incompatible projects response
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [{project_id: 2, 'sdk.name': 'incompatible', count: 1}],
      },
    });

    render(
      <PageAlertProvider>
        <PageAlert />
        <PlatformCompatibilityChecker
          compatibleSDKNames={['foobar']}
          docsUrl="www.example.com"
        >
          <div>Child</div>
        </PlatformCompatibilityChecker>
      </PageAlertProvider>
    );

    expect(
      await screen.findByText(
        /The following selected projects contain data from SDKs that are not supported by this view: incompatible/
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The currently supported SDK platforms are: foobar/)
    ).toBeInTheDocument();
    expect(screen.queryByText('Child')).not.toBeInTheDocument();
  });

  it('renders the children and a warning message if some projects are incompatible', async () => {
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
        projects: [1, 2],
      },
    });

    // Incompatible projects response
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [{project_id: 2, 'sdk.name': 'incompatible', count: 1}],
      },
    });

    render(
      <PageAlertProvider>
        <PageAlert />
        <PlatformCompatibilityChecker
          compatibleSDKNames={['foobar']}
          docsUrl="www.example.com"
        >
          <div>Child</div>
        </PlatformCompatibilityChecker>
      </PageAlertProvider>
    );

    expect(
      await screen.findByText(
        /The following selected projects contain data from SDKs that are not supported by this view: incompatible/
      )
    ).toBeInTheDocument();
    expect(await screen.findByText('Child')).toBeInTheDocument();
  });

  it('handles all project selection', async () => {
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

    // Incompatible projects response
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [{project_id: 2, 'sdk.name': 'incompatible', count: 1}],
      },
    });

    render(
      <PageAlertProvider>
        <PageAlert />
        <PlatformCompatibilityChecker
          compatibleSDKNames={['foobar']}
          docsUrl="www.example.com"
        >
          <div>Child</div>
        </PlatformCompatibilityChecker>
      </PageAlertProvider>
    );

    expect(
      await screen.findByText(
        /The following selected projects contain data from SDKs that are not supported by this view: incompatible/
      )
    ).toBeInTheDocument();
    expect(await screen.findByText('Child')).toBeInTheDocument();
  });
});
