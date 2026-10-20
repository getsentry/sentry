import {GroupFixture} from 'sentry-fixture/group';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectIssues} from 'sentry/views/projectDetail/projectIssues';

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
      url: `/organizations/${organization.slug}/issues-count/`,
      body: {},
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('updates tab counts when the release search changes or is cleared', async () => {
    const props = {
      organization,
      location: LocationFixture(),
      projectId: Number(project.id),
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues-count/`,
      body: {'error.unhandled:true is:unresolved': 6},
    });
    const counts = {
      'is:unresolved is:for_review release:1.2.3': 1,
      'error.unhandled:true is:unresolved release:1.2.3': 3,
      'regressed_in_release:latest release:1.2.3': 4,
      'is:resolved release:1.2.3': null,
      'release:1.2.3': 5,
    };
    const response = Promise.withResolvers<void>();
    const fetchFilteredCounts = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues-count/`,
      match: [
        MockApiClient.matchQuery({
          query: Object.keys(counts),
        }),
      ],
      body: counts,
      asyncDelay: response.promise,
    });

    const {rerender} = render(<ProjectIssues {...props} />, {organization});
    expect(await screen.findByRole('radio', {name: 'Unhandled 6'})).toBeChecked();

    rerender(<ProjectIssues {...props} query="release:1.2.3" />);

    await waitFor(() => expect(fetchFilteredCounts).toHaveBeenCalled());
    expect(screen.getByRole('radio', {name: 'Unhandled 6'})).toBeChecked();
    response.resolve();

    expect(await screen.findByRole('radio', {name: 'Unhandled 3'})).toBeChecked();
    expect(screen.getByRole('radio', {name: 'All Issues 5'})).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'New Issues 1'})).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Resolved 0'})).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Regressed 4'})).toBeInTheDocument();

    rerender(<ProjectIssues {...props} query="" />);
    expect(await screen.findByRole('radio', {name: 'Unhandled 6'})).toBeChecked();
  });

  it('renders a list', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [GroupFixture(), GroupFixture({id: '2'})],
    });
    render(
      <ProjectIssues
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

  it('renders a link to Explore', async () => {
    const {router} = render(
      <ProjectIssues
        organization={organization}
        location={{query: {}} as any}
        projectId={parseInt(project.id, 10)}
      />,
      {
        organization,
      }
    );

    const link = screen.getByLabelText('Open in Explore');
    expect(link).toBeInTheDocument();
    await userEvent.click(link);

    expect(router.location.pathname).toBe(
      `/organizations/${organization.slug}/explore/errors/results/`
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
