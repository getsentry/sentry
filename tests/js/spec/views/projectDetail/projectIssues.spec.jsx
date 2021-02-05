import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import ProjectIssues from 'app/views/projectDetail/projectIssues';

describe('ProjectDetail > ProjectIssues', function () {
  let endpointMock, filteredEndpointMock;
  const {organization, router, routerContext} = initializeOrg();

  beforeEach(function () {
    endpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/?limit=5&query=is%3Aunresolved&sort=freq&statsPeriod=14d`,
      body: [TestStubs.Group(), TestStubs.Group({id: '2'})],
    });

    filteredEndpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/?environment=staging&limit=5&query=is%3Aunresolved&sort=freq&statsPeriod=7d`,
      body: [TestStubs.Group(), TestStubs.Group({id: '2'})],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders a list', function () {
    const wrapper = mountWithTheme(
      <ProjectIssues organization={organization} location={router.location} />,
      routerContext
    );

    expect(wrapper.find('SectionHeading').text()).toBe('Project Issues');
    expect(wrapper.find('StreamGroup').length).toBe(2);
  });

  it('renders a link to Issues', function () {
    const wrapper = mountWithTheme(
      <ProjectIssues organization={organization} location={router.location} />,
      routerContext
    );

    expect(wrapper.find('ControlsWrapper Link').prop('to')).toEqual({
      pathname: `/organizations/${organization.slug}/issues/`,
      query: {
        limit: 5,
        query: 'is:unresolved',
        sort: 'freq',
        statsPeriod: '14d',
      },
    });
  });

  it('changes according to global header', function () {
    const wrapper = mountWithTheme(
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

    expect(wrapper.find('ControlsWrapper Link').prop('to')).toEqual({
      pathname: `/organizations/${organization.slug}/issues/`,
      query: {
        limit: 5,
        environment: 'staging',
        statsPeriod: '7d',
        query: 'is:unresolved',
        sort: 'freq',
      },
    });
  });
});
