import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {browserHistory} from 'react-router';

import EventDetails from 'app/views/eventsV2/eventDetails';
import {ALL_VIEWS, DEFAULT_EVENT_VIEW} from 'app/views/eventsV2/data';
import EventView from 'app/views/eventsV2/eventView';

describe('EventsV2 > EventDetails', function() {
  const allEventsView = EventView.fromSavedQuery(DEFAULT_EVENT_VIEW);
  const errorsView = EventView.fromSavedQuery(
    ALL_VIEWS.find(view => view.name === 'Errors')
  );

  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: {
          id: 'string',
          title: 'string',
          'project.name': 'string',
          timestamp: 'date',
        },
        data: [
          {
            id: 'deadbeef',
            title: 'Oh no something bad',
            'project.name': 'project-slug',
            timestamp: '2019-05-23T22:12:48+00:00',
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/project-slug:deadbeef/',
      method: 'GET',
      body: {
        id: '1234',
        size: 1200,
        projectSlug: 'project-slug',
        eventID: 'deadbeef',
        groupID: '123',
        title: 'Oh no something bad',
        location: '/users/login',
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

    // Missing event
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/project-slug:abad1/',
      method: 'GET',
      statusCode: 404,
      body: {},
    });

    // Error event
    MockApiClient.addMockResponse(
      {
        url: '/organizations/org-slug/events/latest/',
        method: 'GET',
        body: {
          id: '5678',
          size: 1200,
          projectSlug: 'project-slug',
          eventID: 'deadbeef',
          groupID: '123',
          type: 'error',
          title: 'Oh no something bad',
          message: 'It was not good',
          dateCreated: '2019-05-23T22:12:48+00:00',
          previousEventID: 'beefbeef',
          metadata: {
            type: 'Oh no something bad',
          },
          entries: [
            {
              type: 'message',
              message: 'bad stuff',
              data: {},
            },
          ],
          tags: [{key: 'browser', value: 'Firefox'}],
        },
      },
      {
        predicate: (_, options) => {
          const query = options.query.query;
          return (
            query && (query.includes('event.type:error') || query.includes('issue.id'))
          );
        },
      }
    );

    // Transaction event
    MockApiClient.addMockResponse(
      {
        url: '/organizations/org-slug/events/latest/',
        method: 'GET',
        body: {
          id: '5678',
          size: 1200,
          projectSlug: 'project-slug',
          eventID: 'deadbeef',
          type: 'transaction',
          title: 'Oh no something bad',
          location: '/users/login',
          message: 'It was not good',
          startTimestamp: 1564153693.2419,
          endTimestamp: 1564153694.4191,
          previousEventID: 'beefbeef',
          entries: [
            {
              type: 'spans',
              data: [],
            },
          ],
          tags: [{key: 'browser', value: 'Firefox'}],
        },
      },
      {
        predicate: (_, options) => {
          return options.query.query && options.query.query.includes('transaction');
        },
      }
    );
  });

  it('renders', function() {
    const wrapper = mountWithTheme(
      <EventDetails
        organization={TestStubs.Organization({projects: [TestStubs.Project()]})}
        eventSlug="project-slug:deadbeef"
        location={{query: {eventSlug: 'project-slug:deadbeef'}}}
        eventView={allEventsView}
      />,
      TestStubs.routerContext()
    );
    const content = wrapper.find('EventHeader');
    expect(content.text()).toContain('Oh no something bad');

    const graph = wrapper.find('ModalLineGraph');
    expect(graph).toHaveLength(0);
  });

  it('renders a 404', function() {
    const wrapper = mountWithTheme(
      <EventDetails
        organization={TestStubs.Organization({projects: [TestStubs.Project()]})}
        eventSlug="project-slug:abad1"
        location={{query: {eventSlug: 'project-slug:abad1'}}}
        eventView={allEventsView}
      />,
      TestStubs.routerContext()
    );
    const content = wrapper.find('NotFound');
    expect(content).toHaveLength(1);
  });

  it('renders a chart in grouped view', function() {
    const wrapper = mountWithTheme(
      <EventDetails
        organization={TestStubs.Organization({projects: [TestStubs.Project()]})}
        eventSlug="project-slug:deadbeef"
        location={{query: {eventSlug: 'project-slug:deadbeef'}}}
        eventView={errorsView}
      />,
      TestStubs.routerContext()
    );
    const content = wrapper.find('EventHeader');
    expect(content.text()).toContain('Oh no something bad');

    const graph = wrapper.find('ModalLineGraph');
    expect(graph).toHaveLength(1);
  });

  it('removes eventSlug when close button is clicked', function() {
    const wrapper = mountWithTheme(
      <EventDetails
        organization={TestStubs.Organization({projects: [TestStubs.Project()]})}
        eventSlug="project-slug:deadbeef"
        location={{
          pathname: '/organizations/org-slug/events/',
          query: {eventSlug: 'project-slug:deadbeef'},
        }}
        eventView={allEventsView}
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
    const wrapper = mountWithTheme(
      <EventDetails
        organization={organization}
        eventSlug="project-slug:deadbeef"
        location={{query: {eventSlug: 'project-slug:deadbeef'}}}
        eventView={allEventsView}
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
      query: {query: 'browser:Firefox'},
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
    const wrapper = mountWithTheme(
      <EventDetails
        organization={organization}
        eventSlug="project-slug:deadbeef"
        location={{query: {eventSlug: 'project-slug:deadbeef'}}}
        eventView={allEventsView}
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
      query: {query: 'Dumpster browser:Firefox'},
    });
  });
});
