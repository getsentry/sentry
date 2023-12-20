import {Group as GroupFixture} from 'sentry-fixture/group';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectIssues from 'sentry/views/projectDetail/projectIssues';

describe('ProjectDetail > ProjectIssues', function () {
  let endpointMock: ReturnType<typeof MockApiClient.addMockResponse>,
    filteredEndpointMock: ReturnType<typeof MockApiClient.addMockResponse>,
    newIssuesEndpointMock: ReturnType<typeof MockApiClient.addMockResponse>;

  const {organization, router, project, routerContext} = initializeOrg({
    organization: {
      features: ['discover-basic'],
    },
  });

  beforeEach(function () {
    endpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/?limit=5&query=error.unhandled%3Atrue%20is%3Aunresolved&sort=freq&statsPeriod=14d`,
      body: [GroupFixture(), GroupFixture({id: '2'})],
    });

    filteredEndpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/?environment=staging&limit=5&query=error.unhandled%3Atrue%20is%3Aunresolved&sort=freq&statsPeriod=7d`,
      body: [GroupFixture(), GroupFixture({id: '2'})],
    });

    newIssuesEndpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/?limit=5&query=is%3Aunresolved%20is%3Afor_review&sort=freq&statsPeriod=14d`,
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

  afterEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders a list', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/?limit=5&query=error.unhandled%3Atrue%20is%3Aunresolved&sort=freq&statsPeriod=14d`,
      body: [GroupFixture(), GroupFixture({id: '2'})],
    });
    render(
      <ProjectIssues
        api={new MockApiClient()}
        organization={organization}
        location={router.location}
        projectId={parseInt(project.id, 10)}
      />,
      {
        context: routerContext,
        organization,
      }
    );

    expect(await screen.findAllByTestId('group')).toHaveLength(2);
  });

  it('renders a link to Issues', async function () {
    render(
      <ProjectIssues
        api={new MockApiClient()}
        organization={organization}
        projectId={parseInt(project.id, 10)}
        location={router.location}
      />,
      {
        context: routerContext,
        organization,
      }
    );

    const link = screen.getByLabelText('Open in Issues');
    expect(link).toBeInTheDocument();
    await userEvent.click(link);

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/issues/',
      query: {
        limit: 5,
        query: 'error.unhandled:true is:unresolved',
        sort: 'freq',
        statsPeriod: '14d',
      },
    });
  });

  it('renders a segmented control', async function () {
    render(
      <ProjectIssues
        api={new MockApiClient()}
        organization={organization}
        location={router.location}
        projectId={parseInt(project.id, 10)}
      />,
      {
        context: routerContext,
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

    expect(newIssuesEndpointMock).toHaveBeenCalled();
  });

  it('renders a link to Discover', async function () {
    render(
      <ProjectIssues
        api={new MockApiClient()}
        organization={organization}
        location={router.location}
        projectId={parseInt(project.id, 10)}
      />,
      {
        context: routerContext,
        organization,
      }
    );

    const link = screen.getByLabelText('Open in Discover');
    expect(link).toBeInTheDocument();
    await userEvent.click(link);

    expect(router.push).toHaveBeenCalledWith({
      pathname: `/organizations/${organization.slug}/discover/results/`,
      query: {
        display: 'top5',
        field: ['issue', 'title', 'count()', 'count_unique(user)', 'project'],
        name: 'Frequent Unhandled Issues',
        query: 'event.type:error error.unhandled:true',
        sort: ['-count'],
        statsPeriod: '14d',
      },
    });
  });

  it('changes according to global header', async function () {
    render(
      <ProjectIssues
        organization={organization}
        api={new MockApiClient()}
        projectId={parseInt(project.id, 10)}
        location={{
          ...router.location,
          query: {statsPeriod: '7d', environment: 'staging', somethingBad: 'nope'},
        }}
      />,
      {context: routerContext, organization}
    );

    expect(endpointMock).toHaveBeenCalledTimes(0);
    expect(filteredEndpointMock).toHaveBeenCalledTimes(1);

    const link = screen.getByLabelText('Open in Issues');
    expect(link).toBeInTheDocument();
    await userEvent.click(link);

    expect(router.push).toHaveBeenCalledWith({
      pathname: `/organizations/${organization.slug}/issues/`,
      query: {
        limit: 5,
        environment: 'staging',
        statsPeriod: '7d',
        query: 'error.unhandled:true is:unresolved',
        sort: 'freq',
      },
    });
  });
});
