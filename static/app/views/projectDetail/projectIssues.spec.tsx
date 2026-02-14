import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectIssues from 'sentry/views/projectDetail/projectIssues';

describe('ProjectDetail > ProjectIssues', () => {
  let mockFetchIssues: ReturnType<typeof MockApiClient.addMockResponse>;

  const organization = OrganizationFixture({
    features: ['discover-basic'],
  });
  const project = ProjectFixture();

  beforeEach(() => {
    mockFetchIssues = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [GroupFixture(), GroupFixture({id: '2'})],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues-count/?project=${project.id}&query=is%3Aunresolved%20is%3Afor_review&query=&query=is%3Aresolved&query=error.unhandled%3Atrue%20is%3Aunresolved&query=regressed_in_release%3Alatest&statsPeriod=14d`,
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues-count/?environment=staging&project=${project.id}&query=is%3Aunresolved%20is%3Afor_review&query=&query=is%3Aresolved&query=error.unhandled%3Atrue%20is%3Aunresolved&query=regressed_in_release%3Alatest&statsPeriod=7d`,
      body: {},
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders a list', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [GroupFixture(), GroupFixture({id: '2'})],
    });
    render(
      <ProjectIssues
        api={new MockApiClient()}
        organization={organization}
        location={{query: {}} as any}
        projectId={parseInt(project.id, 10)}
      />,
      {
        organization,
      }
    );

    expect(await screen.findAllByTestId('group')).toHaveLength(2);
  });

  it('renders a link to Issues', async () => {
    const {router} = render(
      <ProjectIssues
        api={new MockApiClient()}
        organization={organization}
        projectId={parseInt(project.id, 10)}
        location={{query: {}} as any}
      />,
      {
        organization,
      }
    );

    const link = screen.getByLabelText('Open in Issues');
    expect(link).toBeInTheDocument();
    await userEvent.click(link);

    expect(router.location.pathname).toBe('/organizations/org-slug/issues/');
    expect(router.location.query).toEqual({
      limit: '5',
      query: 'error.unhandled:true is:unresolved',
      sort: 'freq',
      statsPeriod: '14d',
    });
  });

  it('renders a segmented control', async () => {
    render(
      <ProjectIssues
        api={new MockApiClient()}
        organization={organization}
        location={{query: {}} as any}
        projectId={parseInt(project.id, 10)}
      />,
      {
        organization,
      }
    );

    // "Unhandled" segment is selected
    const unhandledSegment = screen.getByRole('radio', {name: 'Unhandled 0'});
    expect(unhandledSegment).toBeInTheDocument();
    expect(unhandledSegment).toBeChecked();

    // Select "New Issues" segment
    const newIssuesSegment = screen.getByRole('radio', {name: 'New Issues 0'});
    expect(newIssuesSegment).toBeInTheDocument();
    expect(newIssuesSegment).not.toBeChecked();

    await userEvent.click(newIssuesSegment);
    await waitFor(() => expect(newIssuesSegment).toBeChecked());

    expect(mockFetchIssues).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'error.unhandled:true is:unresolved',
        }),
      })
    );
  });

  it('renders a link to Discover', async () => {
    const {router} = render(
      <ProjectIssues
        api={new MockApiClient()}
        organization={organization}
        location={{query: {}} as any}
        projectId={parseInt(project.id, 10)}
      />,
      {
        organization,
      }
    );

    const link = screen.getByLabelText('Open in Discover');
    expect(link).toBeInTheDocument();
    await userEvent.click(link);

    expect(router.location.pathname).toBe(
      `/organizations/${organization.slug}/explore/discover/results/`
    );
    expect(router.location.query).toEqual({
      display: 'top5',
      field: ['issue', 'title', 'count()', 'count_unique(user)', 'project'],
      name: 'Frequent Unhandled Issues',
      query: 'event.type:error error.unhandled:true',
      queryDataset: 'error-events',
      sort: '-count',
      statsPeriod: '14d',
    });
  });

  it('changes according to global header', async () => {
    const locationWithQuery = {
      query: {statsPeriod: '7d', environment: 'staging', somethingBad: 'nope'},
    } as any;

    const {router} = render(
      <ProjectIssues
        organization={organization}
        api={new MockApiClient()}
        projectId={parseInt(project.id, 10)}
        location={locationWithQuery}
      />,
      {
        organization,
      }
    );

    await waitFor(() => {
      expect(mockFetchIssues).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'error.unhandled:true is:unresolved',
          }),
        })
      );
    });

    const link = screen.getByLabelText('Open in Issues');
    expect(link).toBeInTheDocument();
    await userEvent.click(link);

    expect(router.location.pathname).toBe(`/organizations/${organization.slug}/issues/`);
    expect(router.location.query).toEqual({
      limit: '5',
      environment: 'staging',
      statsPeriod: '7d',
      query: 'error.unhandled:true is:unresolved',
      sort: 'freq',
    });
  });
});
