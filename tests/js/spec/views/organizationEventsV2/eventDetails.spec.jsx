import React from 'react';
import {mount} from 'enzyme';
import {initializeOrg} from 'app-test/helpers/initializeOrg';
import {browserHistory} from 'react-router';

import EventDetails from 'app/views/organizationEventsV2/eventDetails';
import {ALL_VIEWS} from 'app/views/organizationEventsV2/data';

describe('OrganizationEventsV2 > EventDetails', function() {
  const allEventsView = ALL_VIEWS.find(view => view.id === 'all');
  const errorsView = ALL_VIEWS.find(view => view.id === 'errors');

  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: [
        {
          id: 'deadbeef',
          title: 'Oh no something bad',
          'project.name': 'project-slug',
          timestamp: '2019-05-23T22:12:48+00:00',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/project-slug:deadbeef/',
      method: 'GET',
      body: {
        id: '1234',
        size: 1200,
        projectSlug: 'org-slug',
        eventID: 'deadbeef',
        groupID: '123',
        title: 'Oh no something bad',
        message: 'It was not good',
        dateCreated: '2019-05-23T22:12:48+00:00',
        entries: [
          {
            type: 'message',
            message: 'bad stuff',
            data: {},
          },
        ],
        tags: [{key: 'browser', value: 'Firefox'}],
      },
    });
    MockApiClient.addMockResponse({
      url: '/issues/123/',
      method: 'GET',
      body: TestStubs.Group({id: '123'}),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      method: 'GET',
      body: {
        data: [[1234561700, [1]], [1234561800, [1]]],
      },
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/latest/',
      method: 'GET',
      body: {
        id: '1234',
        size: 1200,
        projectSlug: 'org-slug',
        eventID: 'deadbeef',
        groupID: '123',
        title: 'Oh no something bad',
        message: 'It was not good',
        dateCreated: '2019-05-23T22:12:48+00:00',
        entries: [
          {
            type: 'message',
            message: 'bad stuff',
            data: {},
          },
        ],
        tags: [{key: 'browser', value: 'Firefox'}],
      },
    });
  });

  it('renders', function() {
    const wrapper = mount(
      <EventDetails
        organization={TestStubs.Organization({projects: [TestStubs.Project()]})}
        eventSlug="project-slug:deadbeef"
        location={{query: {eventSlug: 'project-slug:deadbeef'}}}
        view={allEventsView}
      />,
      TestStubs.routerContext()
    );
    const content = wrapper.find('EventHeader');
    expect(content.text()).toContain('Oh no something bad');

    const graph = wrapper.find('ModalLineGraph');
    expect(graph).toHaveLength(0);
  });

  it('renders a chart in grouped view', function() {
    const wrapper = mount(
      <EventDetails
        organization={TestStubs.Organization({projects: [TestStubs.Project()]})}
        groupSlug="project-slug:123:latest"
        location={{query: {groupSlug: 'project-slug:123:latest'}}}
        view={errorsView}
      />,
      TestStubs.routerContext()
    );
    const content = wrapper.find('EventHeader');
    expect(content.text()).toContain('Oh no something bad');

    const graph = wrapper.find('ModalLineGraph');
    expect(graph).toHaveLength(1);
  });

  it('renders pagination buttons in grouped view', function() {
    const wrapper = mount(
      <EventDetails
        organization={TestStubs.Organization({projects: [TestStubs.Project()]})}
        groupSlug="project-slug:123:latest"
        location={{query: {groupSlug: 'project-slug:999:latest'}}}
        view={errorsView}
      />,
      TestStubs.routerContext()
    );
    const content = wrapper.find('ModalPagination');
    expect(content).toHaveLength(1);
  });

  it('removes eventSlug when close button is clicked', function() {
    const wrapper = mount(
      <EventDetails
        organization={TestStubs.Organization({projects: [TestStubs.Project()]})}
        eventSlug="project-slug:deadbeef"
        location={{
          pathname: '/organizations/org-slug/events/',
          query: {eventSlug: 'project-slug:deadbeef'},
        }}
        view={allEventsView}
      />,
      TestStubs.routerContext()
    );
    const button = wrapper.find('DismissButton');
    button.simulate('click');
    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/events/',
      query: {},
    });
  });

  it('removes groupSlug when close button is clicked', function() {
    const wrapper = mount(
      <EventDetails
        organization={TestStubs.Organization({projects: [TestStubs.Project()]})}
        groupSlug="project-slug:123:latest"
        location={{
          pathname: '/organizations/org-slug/events/',
          query: {groupSlug: 'project-slug:123:latest'},
        }}
        view={allEventsView}
      />,
      TestStubs.routerContext()
    );
    const button = wrapper.find('DismissButton');
    button.simulate('click');
    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/events/',
      query: {},
    });
  });

  it('removes transactionSlug when close button is clicked', function() {
    const wrapper = mount(
      <EventDetails
        organization={TestStubs.Organization({projects: [TestStubs.Project()]})}
        transactionSlug="project-slug:/users/login:latest"
        location={{
          pathname: '/organizations/org-slug/events/',
          query: {groupSlug: 'project-slug:/users/login:latest'},
        }}
        view={allEventsView}
      />,
      TestStubs.routerContext()
    );
    const button = wrapper.find('DismissButton');
    button.simulate('click');
    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/events/',
      query: {},
    });
  });

  it('navigates when tag values are clicked', async function() {
    const {organization, routerContext} = initializeOrg({
      organization: TestStubs.Organization({projects: [TestStubs.Project()]}),
      router: {
        location: {
          pathname: '/organizations/org-slug/events/',
          query: {
            eventSlug: 'project-slug:deadbeef',
          },
        },
      },
    });
    const wrapper = mount(
      <EventDetails
        organization={organization}
        eventSlug="project-slug:deadbeef"
        location={{query: {eventSlug: 'project-slug:deadbeef'}}}
        view={allEventsView}
      />,
      routerContext
    );
    await tick();
    await wrapper.update();

    // Get the first link as we wrap react-router's link
    const tagLink = wrapper.find('EventDetails TagsTable TagValue Link').first();

    // Should remove eventSlug and append new tag value causing
    // the view to re-render
    expect(tagLink.props().to).toEqual({
      pathname: '/organizations/org-slug/events/',
      query: {query: 'browser:"Firefox"'},
    });
  });

  it('appends tag value to existing query when clicked', async function() {
    const {organization, routerContext} = initializeOrg({
      organization: TestStubs.Organization({projects: [TestStubs.Project()]}),
      router: {
        location: {
          pathname: '/organizations/org-slug/events/',
          query: {
            query: 'Dumpster',
            eventSlug: 'project-slug:deadbeef',
          },
        },
      },
    });
    const wrapper = mount(
      <EventDetails
        organization={organization}
        eventSlug="project-slug:deadbeef"
        location={{query: {eventSlug: 'project-slug:deadbeef'}}}
        view={allEventsView}
      />,
      routerContext
    );
    await tick();
    await wrapper.update();

    // Get the first link as we wrap react-router's link
    const tagLink = wrapper.find('EventDetails TagsTable TagValue Link').first();

    // Should remove eventSlug and append new tag value causing
    // the view to re-render
    expect(tagLink.props().to).toEqual({
      pathname: '/organizations/org-slug/events/',
      query: {query: 'Dumpster browser:"Firefox"'},
    });
  });
});
