import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';
import {ReleaseMetaFixture} from 'sentry-fixture/releaseMeta';
import {ReleaseProjectFixture} from 'sentry-fixture/releaseProject';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import {ReleasesDrawerDetails} from './releasesDrawerDetails';
import {ReleasesDrawerFields} from './utils';

// Mock GroupList as it throws act warnings
jest.mock('sentry/components/issues/groupList', () => ({
  __esModule: true,
  GroupList: () => <div>GroupList</div>,
}));

describe('ReleasesDrawerDetails', () => {
  const defaultProps = {
    release: 'test-release',
    projectId: undefined,
    start: null,
    end: null,
  };

  const organization = OrganizationFixture();
  const renderOptions = {
    organization,
    initialRouterConfig: {
      location: {pathname: '/releases/', query: {}},
    },
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();

    ProjectsStore.reset();
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'test-project'}),
      ProjectFixture({id: '2', slug: 'test-project-2'}),
    ]);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/test-release/meta/',
      method: 'GET',
      body: ReleaseMetaFixture(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/test-release/',
      method: 'GET',
      body: ReleaseFixture(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/test-release/deploys/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/test-project/releases/test-release/repositories/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/test-project-2/releases/test-release/repositories/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/repos/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/?end=2017-10-17T02%3A42%3A00Z&groupStatsPeriod=auto&limit=10&project=2&query=first-release%3Atest-release&sort=freq&start=2017-10-17T02%3A41%3A00Z',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/?end=2020-03-24T02%3A04%3A59Z&groupStatsPeriod=auto&limit=10&project=2&query=first-release%3Atest-release&sort=freq&start=2020-03-23T01%3A02%3A00Z',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/?end=2017-10-17T02%3A42%3A00Z&groupStatsPeriod=auto&limit=10&project=1&query=first-release%3Atest-release&sort=freq&start=2017-10-17T02%3A41%3A00Z',
      method: 'GET',
      body: [],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders content when projectId exists', async () => {
    render(<ReleasesDrawerDetails {...defaultProps} projectId="1" />, renderOptions);

    expect(await screen.findByText('Details')).toBeInTheDocument();
    // no start/end from url params, so there is no releases crumb to link back to
    expect(screen.queryByRole('link', {name: 'Releases'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'View Full Details'})).toHaveAttribute(
      'href',
      expect.stringContaining('/releases/test-release/?project=1')
    );
    // the full-details link is an action on the version crumb
    expect(screen.getByRole('navigation', {name: 'Breadcrumbs'})).toContainElement(
      screen.getByRole('button', {name: 'View Full Details'})
    );
    // single-project releases don't need a project switcher
    expect(screen.queryByRole('button', {name: 'project-slug'})).not.toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Commits')).toBeInTheDocument();
    expect(screen.getByText('File Changes')).toBeInTheDocument();
  });

  it('links back to releases page when start and end are provided', async () => {
    render(
      <ReleasesDrawerDetails
        {...defaultProps}
        projectId="1"
        start={new Date()}
        end={new Date()}
      />,
      renderOptions
    );

    const link = await screen.findByRole('link', {name: 'Releases'});
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining(
        '/releases/?rdEnd=2017-10-17T02%3A41%3A20.000Z&rdStart=2017-10-17T02%3A41%3A20.000Z'
      )
    );
  });

  it('renders content when single project exists in release meta', async () => {
    render(<ReleasesDrawerDetails {...defaultProps} />, renderOptions);

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(await screen.findByText('Details')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Commits')).toBeInTheDocument();
    expect(screen.getByText('File Changes')).toBeInTheDocument();
  });

  it('can switch projects when multiple projects exist', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/test-release/meta/',
      method: 'GET',
      body: ReleaseMetaFixture({
        projects: [
          ReleaseProjectFixture({
            id: 1,
            slug: 'test-project',
            platform: 'android',
            platforms: ['android'],
          }),
          ReleaseProjectFixture({
            id: 2,
            slug: 'test-project-2',
            platform: 'javascript',
            platforms: ['javascript'],
          }),
        ],
      }),
    });
    const {router} = render(
      <ReleasesDrawerDetails {...defaultProps} projectId="2" />,
      renderOptions
    );

    expect(await screen.findByText('Details')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Commits')).toBeInTheDocument();
    expect(screen.getByText('File Changes')).toBeInTheDocument();

    // The trigger shows the selected project's slug, like the project page filter
    await userEvent.click(await screen.findByRole('button', {name: 'test-project-2'}));
    await userEvent.click(screen.getByRole('option', {name: 'test-project'}));
    expect(router.location.query[ReleasesDrawerFields.RELEASE_PROJECT_ID]).toBe('1');
  });

  it('renders error state when release meta fails to load', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/test-release/meta/',
      method: 'GET',
      statusCode: 400,
      body: {},
    });

    render(<ReleasesDrawerDetails {...defaultProps} />, renderOptions);
    expect(await screen.findByText('Release not found')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'View Full Details'})
    ).not.toBeInTheDocument();
  });

  it('reserves the project avatar slot while release meta loads', async () => {
    render(<ReleasesDrawerDetails {...defaultProps} />, renderOptions);

    const navigation = screen.getByRole('navigation', {name: 'Breadcrumbs'});
    expect(
      within(navigation).getByTestId('release-project-placeholder')
    ).toBeInTheDocument();

    expect(await screen.findByText('Details')).toBeInTheDocument();
    expect(
      within(navigation).queryByTestId('release-project-placeholder')
    ).not.toBeInTheDocument();
  });

  it('does not keep the avatar placeholder for multi-project releases', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/test-release/meta/',
      method: 'GET',
      body: ReleaseMetaFixture({
        projects: [
          ReleaseProjectFixture(),
          ReleaseProjectFixture({id: 2, slug: 'project-slug2'}),
        ],
      }),
    });

    render(<ReleasesDrawerDetails {...defaultProps} />, renderOptions);

    expect(await screen.findByText('Select a project')).toBeInTheDocument();
    expect(screen.queryByTestId('release-project-placeholder')).not.toBeInTheDocument();
  });

  it('renders project selection when multiple projects exist', async () => {
    const releaseMeta = ReleaseMetaFixture({
      projects: [
        ReleaseProjectFixture(),
        ReleaseProjectFixture({id: 2, slug: 'project-slug2'}),
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/test-release/meta/',
      method: 'GET',
      body: releaseMeta,
    });

    const {router} = render(<ReleasesDrawerDetails {...defaultProps} />, renderOptions);
    expect(
      await screen.findByText(
        'This release exists in multiple projects. Please select a project to view details.'
      )
    ).toBeInTheDocument();

    // Simulate selecting "project-2" from the Select component
    await userEvent.click(screen.getByText('Select a project'));
    await userEvent.click(screen.getByText('project-slug2'));

    expect(router.location.pathname).toBe('/releases/');
    expect(router.location.query).toEqual({
      [ReleasesDrawerFields.RELEASE_PROJECT_ID]: '2',
    });
  });

  it('renders project not found error when project is invalid', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/test-release/meta/',
      method: 'GET',
      body: ReleaseMetaFixture({
        projects: [
          {
            id: 1,
            slug: 'test-project',
            name: 'Test Project',
            newGroups: 0,
            platform: 'javascript',
            platforms: ['javascript'],
          },
          {
            id: 2,
            slug: 'test-project-2',
            name: 'Test Project 2',
            newGroups: 0,
            platform: 'javascript',
            platforms: ['javascript'],
          },
        ],
      }),
    });
    render(
      <ReleasesDrawerDetails {...defaultProps} projectId="invalid" />,
      renderOptions
    );
    expect(await screen.findByText('Project not found')).toBeInTheDocument();
  });
});
