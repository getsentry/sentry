import React from 'react';
import {mount} from 'enzyme';
import {browserHistory} from 'react-router';

import {initializeOrg} from 'app-test/helpers/initializeOrg';
import GroupEventDetails from 'app/views/groupDetails/shared/groupEventDetails';

describe('groupEventDetails', () => {
  let org;
  let project;
  let routerContext;
  let group;
  let event;

  beforeEach(() => {
    const props = initializeOrg();
    org = props.organization;
    project = props.project;
    project.organization = org;
    routerContext = props.routerContext;

    group = TestStubs.Group();
    event = TestStubs.Event({
      size: 1,
      dateCreated: '2019-03-20T00:00:00.000Z',
      errors: [],
      entries: [],
      tags: [{key: 'environment', value: 'dev'}],
    });

    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/`,
      body: group,
    });

    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/events/latest/`,
      body: event,
    });

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/issues/`,
      method: 'PUT',
    });

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/events/${event.id}/committers/`,
      body: {committers: []},
    });

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/events/${event.id}/owners/`,
      body: {owners: [], rules: []},
    });

    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/participants/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/tags/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/groups/${group.id}/integrations/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/sentry-apps/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/sentry-app-installations/`,
      body: [],
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
    browserHistory.replace.mockClear();
  });

  it('redirects on switching to an invalid environment selection for event', async function() {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/events/1/`,
      body: event,
    });
    const wrapper = mount(
      <GroupEventDetails
        group={group}
        project={project}
        organization={org}
        environments={[{id: '1', name: 'dev', displayName: 'Dev'}]}
        params={{orgId: org.slug, groupId: group.id, eventId: '1'}}
      />,
      routerContext
    );
    await tick();
    expect(browserHistory.replace).not.toHaveBeenCalled();
    wrapper.setProps({environments: [{id: '1', name: 'prod', displayName: 'Prod'}]});
    await tick();

    expect(browserHistory.replace).toHaveBeenCalled();
  });

  it('does not redirect when switching to a valid environment selection for event', async function() {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/events/1/`,
      body: event,
    });
    const wrapper = mount(
      <GroupEventDetails
        group={group}
        project={project}
        organization={org}
        environments={[{id: '1', name: 'dev', displayName: 'Dev'}]}
        params={{orgId: org.slug, group: group.id, eventId: '1'}}
      />,
      routerContext
    );
    await tick();
    expect(browserHistory.replace).not.toHaveBeenCalled();
    wrapper.setProps({environments: []});
    await tick();

    expect(browserHistory.replace).not.toHaveBeenCalled();
  });

  it("doesn't load Sentry Apps without being flagged in", () => {
    const request = MockApiClient.addMockResponse({
      url: '/sentry-apps/',
      body: [],
    });

    mount(
      <GroupEventDetails
        group={group}
        project={project}
        organization={org}
        environments={[{id: '1', name: 'dev', displayName: 'Dev'}]}
        params={{}}
      />,
      routerContext
    );

    expect(request).not.toHaveBeenCalled();
  });

  it('loads Sentry Apps when flagged in', () => {
    const request = MockApiClient.addMockResponse({
      url: '/sentry-apps/',
      body: [],
    });

    org.features = ['sentry-apps'];
    project.organization = org;

    mount(
      <GroupEventDetails
        group={group}
        project={project}
        organization={org}
        environments={[{id: '1', name: 'dev', displayName: 'Dev'}]}
        params={{}}
      />,
      routerContext
    );

    expect(request).toHaveBeenCalledTimes(1);
  });
});
