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

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/sentry-app-components/?projectId=${project.id}`,
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
        location={{}}
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
        location={{}}
      />,
      routerContext
    );
    await tick();
    expect(browserHistory.replace).not.toHaveBeenCalled();
    wrapper.setProps({environments: []});
    await tick();

    expect(browserHistory.replace).not.toHaveBeenCalled();
  });

  it('next/prev links', async function() {
    event = TestStubs.Event({
      size: 1,
      dateCreated: '2019-03-20T00:00:00.000Z',
      errors: [],
      entries: [],
      tags: [{key: 'environment', value: 'dev'}],
      previousEventID: 'prev-event-id',
      nextEventID: 'next-event-id',
    });

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
        location={{query: {environment: 'dev'}}}
      />,
      routerContext
    );
    await tick();

    wrapper.update();

    const buttons = wrapper
      .find('.event-toolbar')
      .find('.btn-group')
      .find('Link');

    expect(buttons.at(0).prop('to')).toEqual({
      pathname: '/org-slug/project-slug/issues/1/events/oldest/',
      query: {environment: 'dev'},
    });

    expect(buttons.at(1).prop('to')).toEqual({
      pathname: '/org-slug/project-slug/issues/1/events/prev-event-id/',
      query: {environment: 'dev'},
    });
    expect(buttons.at(2).prop('to')).toEqual({
      pathname: '/org-slug/project-slug/issues/1/events/next-event-id/',
      query: {environment: 'dev'},
    });
    expect(buttons.at(3).prop('to')).toEqual({
      pathname: '/org-slug/project-slug/issues/1/events/latest/',
      query: {environment: 'dev'},
    });
  });

  it('loads Sentry Apps', () => {
    const request = MockApiClient.addMockResponse({
      url: '/sentry-apps/',
      body: [],
    });

    project.organization = org;

    mount(
      <GroupEventDetails
        group={group}
        project={project}
        organization={org}
        environments={[{id: '1', name: 'dev', displayName: 'Dev'}]}
        params={{}}
        location={{}}
      />,
      routerContext
    );

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('loads sentry app components when flagged in', () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/sentry-app-components/?projectId=${project.id}`,
      body: [],
    });

    project.organization = org;

    mount(
      <GroupEventDetails
        group={group}
        project={project}
        organization={org}
        environments={[{id: '1', name: 'dev', displayName: 'Dev'}]}
        params={{}}
        location={{}}
      />,
      routerContext
    );

    expect(request).toHaveBeenCalledTimes(1);
  });
});
