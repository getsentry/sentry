import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import ProjectIssues from 'sentry/views/projectDetail/projectIssues';

describe('ProjectDetail > ProjectIssues', function () {
  let endpointMock, filteredEndpointMock, wrapper;
  const {organization, router, routerContext} = initializeOrg({
    organization: {
      features: ['discover-basic'],
    },
  });

  beforeEach(function () {
    endpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/?limit=5&query=is%3Aunresolved%20error.unhandled%3Atrue&sort=freq&statsPeriod=14d`,
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
    wrapper.unmount();
  });

  it('renders a list', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/?limit=5&query=error.unhandled%3Atrue%20is%3Aunresolved&sort=freq&statsPeriod=14d`,
      body: [TestStubs.Group(), TestStubs.Group({id: '2'})],
    });
    wrapper = mountWithTheme(
      <ProjectIssues organization={organization} location={router.location} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('StreamGroup').length).toBe(2);
  });

  it('renders a link to Issues', function () {
    wrapper = mountWithTheme(
      <ProjectIssues organization={organization} location={router.location} />,
      routerContext
    );

    expect(
      wrapper.find('ControlsWrapper Link[aria-label="Open in Issues"]').at(0).prop('to')
    ).toEqual({
      pathname: `/organizations/${organization.slug}/issues/`,
      query: {
        limit: 5,
        query: 'error.unhandled:true is:unresolved',
        sort: 'freq',
        statsPeriod: '14d',
      },
    });
  });

  it('renders a link to Discover', function () {
    wrapper = mountWithTheme(
      <ProjectIssues organization={organization} location={router.location} />,
      routerContext
    );

    expect(
      wrapper.find('ControlsWrapper Link[aria-label="Open in Discover"]').at(0).prop('to')
    ).toEqual({
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
    wrapper = mountWithTheme(
      <ProjectIssues
        organization={organization}
        location={{
          query: {statsPeriod: '7d', environment: 'staging', somethingBad: 'nope'},
        }}
      />,
      routerContext
    );

    expect(endpointMock).toHaveBeenCalledTimes(0);
    expect(filteredEndpointMock).toHaveBeenCalledTimes(1);

    expect(
      wrapper.find('ControlsWrapper Link[aria-label="Open in Issues"]').at(0).prop('to')
    ).toEqual({
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
