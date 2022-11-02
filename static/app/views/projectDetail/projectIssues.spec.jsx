import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectIssues from 'sentry/views/projectDetail/projectIssues';

describe('ProjectDetail > ProjectIssues', function () {
  let endpointMock, filteredEndpointMock;
  const {organization, router, routerContext} = initializeOrg({
    organization: {
      features: ['discover-basic'],
    },
  });

  beforeEach(function () {
    endpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/?limit=5&query=error.unhandled%3Atrue%20is%3Aunresolved&sort=freq&statsPeriod=14d`,
      body: [TestStubs.Group(), TestStubs.Group({id: '2'})],
    });

    filteredEndpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/?environment=staging&limit=5&query=error.unhandled%3Atrue%20is%3Aunresolved&sort=freq&statsPeriod=7d`,
      body: [TestStubs.Group(), TestStubs.Group({id: '2'})],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders a list', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/?limit=5&query=error.unhandled%3Atrue%20is%3Aunresolved&sort=freq&statsPeriod=14d`,
      body: [TestStubs.Group(), TestStubs.Group({id: '2'})],
    });
    render(<ProjectIssues organization={organization} location={router.location} />, {
      context: routerContext,
      organization,
    });

    expect(await screen.findAllByTestId('group')).toHaveLength(2);
  });

  it('renders a link to Issues', function () {
    render(<ProjectIssues organization={organization} location={router.location} />, {
      context: routerContext,
      organization,
    });

    const link = screen.getByLabelText('Open in Issues');
    expect(link).toBeInTheDocument();
    userEvent.click(link);

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

  it('renders a link to Discover', function () {
    render(<ProjectIssues organization={organization} location={router.location} />, {
      context: routerContext,
      organization,
    });

    const link = screen.getByLabelText('Open in Discover');
    expect(link).toBeInTheDocument();
    userEvent.click(link);

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

  it('changes according to global header', function () {
    render(
      <ProjectIssues
        organization={organization}
        location={{
          query: {statsPeriod: '7d', environment: 'staging', somethingBad: 'nope'},
        }}
      />,
      {context: routerContext, organization}
    );

    expect(endpointMock).toHaveBeenCalledTimes(0);
    expect(filteredEndpointMock).toHaveBeenCalledTimes(1);

    const link = screen.getByLabelText('Open in Issues');
    expect(link).toBeInTheDocument();
    userEvent.click(link);

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
