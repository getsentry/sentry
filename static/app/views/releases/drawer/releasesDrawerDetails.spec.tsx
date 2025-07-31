import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';
import {ReleaseMetaFixture} from 'sentry-fixture/releaseMeta';
import {ReleaseProjectFixture} from 'sentry-fixture/releaseProject';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {useNavigate} from 'sentry/utils/useNavigate';
import {ReleasesDrawerDetails} from 'sentry/views/releases/drawer/releasesDrawerDetails';
import {ReleasesDrawerFields} from 'sentry/views/releases/drawer/utils';

// Mock GroupList as it throws act warnings
jest.mock('sentry/components/issues/groupList', () => ({
  __esModule: true,
  default: () => <div>GroupList</div>,
}));

// Mock the hooks
jest.mock('sentry/utils/useLocation', () => ({
  useLocation: jest.fn().mockReturnValue({
    pathname: '/releases/',
    query: {},
  }),
}));

jest.mock('sentry/utils/useNavigate', () => ({
  __esModule: true,
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

describe('ReleasesDrawerDetails', () => {
  const defaultProps = {
    release: 'test-release',
    projectId: undefined,
    start: null,
    end: null,
  };

  const organization = OrganizationFixture();

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
    render(<ReleasesDrawerDetails {...defaultProps} projectId="1" />, {organization});

    // no start/end from url params, so can't link back to releases
    const notLink = await screen.findByText('Releases');
    expect(notLink).not.toHaveAttribute('href');

    expect(await screen.findByText('Details')).toBeInTheDocument();
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
      {organization}
    );

    const link = await screen.findByText('Releases');
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining(
        '/mock-pathname/?rdEnd=2017-10-17T02%3A41%3A20.000Z&rdStart=2017-10-17T02%3A41%3A20.000Z'
      )
    );
  });

  it('renders content when single project exists in release meta', async () => {
    render(<ReleasesDrawerDetails {...defaultProps} />, {organization});

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
    render(<ReleasesDrawerDetails {...defaultProps} projectId="2" />, {organization});

    expect(await screen.findByText('Details')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Commits')).toBeInTheDocument();
    expect(screen.getByText('File Changes')).toBeInTheDocument();

    // assert that the <Link> component goes to the correct url
    const link = screen.getByTestId('select-project-1');
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('/?rdReleaseProjectId=1')
    );
  });

  it('renders error state when release meta fails to load', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/test-release/meta/',
      method: 'GET',
      statusCode: 400,
      body: {},
    });

    render(<ReleasesDrawerDetails {...defaultProps} />, {organization});
    expect(await screen.findByText('Release not found')).toBeInTheDocument();
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

    render(<ReleasesDrawerDetails {...defaultProps} />, {organization});
    expect(
      await screen.findByText(
        'This release exists in multiple projects. Please select a project to view details.'
      )
    ).toBeInTheDocument();

    const navigate = useNavigate();
    // Simulate selecting "project-2" from the Select component
    await userEvent.click(screen.getByText('Select a project'));
    await userEvent.click(screen.getByText('project-slug2'));

    // Check that navigate was called with the correct query params
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          [ReleasesDrawerFields.RELEASE_PROJECT_ID]: '2',
        }),
      }),
      {replace: true}
    );
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
    render(<ReleasesDrawerDetails {...defaultProps} projectId="invalid" />, {
      organization,
    });
    expect(await screen.findByText('Project not found')).toBeInTheDocument();
  });
});
