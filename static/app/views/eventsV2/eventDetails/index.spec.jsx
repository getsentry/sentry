import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';
import {ALL_VIEWS, DEFAULT_EVENT_VIEW} from 'sentry/views/eventsV2/data';
import EventDetails from 'sentry/views/eventsV2/eventDetails';

describe('EventsV2 > EventDetails', function () {
  const allEventsView = EventView.fromSavedQuery(DEFAULT_EVENT_VIEW);
  const errorsView = EventView.fromSavedQuery(
    ALL_VIEWS.find(view => view.name === 'Errors by Title')
  );

  beforeEach(function () {
    act(() => ProjectsStore.loadInitialData([TestStubs.Project()]));

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/',
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
        tags: [
          {key: 'browser', value: 'Firefox'},
          {key: 'device.uuid', value: 'test-uuid'},
          {key: 'release', value: '82ebf297206a'},
        ],
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
        data: [
          [1234561700, [1]],
          [1234561800, [1]],
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/events/1234/committers/',
      method: 'GET',
      statusCode: 404,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/events/1234/grouping-info/',
      body: {},
    });

    // Missing event
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/project-slug:abad1/',
      method: 'GET',
      statusCode: 404,
      body: {},
    });
  });

  it('renders', async function () {
    render(
      <EventDetails
        organization={TestStubs.Organization()}
        params={{eventSlug: 'project-slug:deadbeef'}}
        location={{query: allEventsView.generateQueryStringObject()}}
      />
    );
    expect(await screen.findByText('Oh no something bad')).toBeInTheDocument();
  });

  it('renders a 404', async function () {
    render(
      <EventDetails
        organization={TestStubs.Organization()}
        params={{eventSlug: 'project-slug:abad1'}}
        location={{query: allEventsView.generateQueryStringObject()}}
      />
    );

    expect(await screen.findByText('Page Not Found')).toBeInTheDocument();
  });

  it('renders a chart in grouped view', async function () {
    render(
      <EventDetails
        organization={TestStubs.Organization()}
        params={{eventSlug: 'project-slug:deadbeef'}}
        location={{query: errorsView.generateQueryStringObject()}}
      />
    );
    expect(await screen.findByText('Oh no something bad')).toBeInTheDocument();
  });

  it('renders an alert when linked issues are missing', async function () {
    MockApiClient.addMockResponse({
      url: '/issues/123/',
      statusCode: 404,
      method: 'GET',
      body: {},
    });
    render(
      <EventDetails
        organization={TestStubs.Organization()}
        params={{eventSlug: 'project-slug:deadbeef'}}
        location={{query: allEventsView.generateQueryStringObject()}}
      />
    );
    expect(
      await screen.findByText(
        'The linked issue cannot be found. It may have been deleted, or merged.'
      )
    ).toBeInTheDocument();
  });

  it('navigates when tag values are clicked', async function () {
    const {organization, routerContext} = initializeOrg({
      organization: TestStubs.Organization(),
      router: {
        location: {
          pathname: '/organizations/org-slug/discover/project-slug:deadbeef',
          query: {},
        },
      },
    });
    render(
      <EventDetails
        organization={organization}
        params={{eventSlug: 'project-slug:deadbeef'}}
        location={{query: allEventsView.generateQueryStringObject()}}
      />,
      {context: routerContext}
    );

    // Get the first link as we wrap react-router's link
    expect(await screen.findByText('Firefox')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Firefox'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/discover/results/?field=title&field=event.type&field=project&field=user.display&field=timestamp&name=All%20Events&query=browser%3AFirefox%20title%3A%22Oh%20no%20something%20bad%22&sort=-timestamp&statsPeriod=24h&yAxis=count%28%29'
    );

    // Get the second link
    expect(screen.getByRole('link', {name: 'test-uuid'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/discover/results/?field=title&field=event.type&field=project&field=user.display&field=timestamp&name=All%20Events&query=tags%5Bdevice.uuid%5D%3Atest-uuid%20title%3A%22Oh%20no%20something%20bad%22&sort=-timestamp&statsPeriod=24h&yAxis=count%28%29'
    );

    // Get the third link
    expect(screen.getByRole('link', {name: '82ebf297206a'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/discover/results/?field=title&field=event.type&field=project&field=user.display&field=timestamp&name=All%20Events&query=release%3A82ebf297206a%20title%3A%22Oh%20no%20something%20bad%22&sort=-timestamp&statsPeriod=24h&yAxis=count%28%29'
    );
  });

  it('navigates to homepage when tag values are clicked', async function () {
    const {organization, routerContext, router} = initializeOrg({
      organization: TestStubs.Organization(),
      router: {
        location: {
          pathname: '/organizations/org-slug/discover/project-slug:deadbeef',
          query: {...allEventsView.generateQueryStringObject(), homepage: 'true'},
        },
      },
    });
    render(
      <EventDetails
        organization={organization}
        params={{eventSlug: 'project-slug:deadbeef'}}
        location={router.location}
      />,
      {context: routerContext}
    );

    // Get the first link as we wrap react-router's link
    expect(await screen.findByText('Firefox')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Firefox'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/discover/homepage/?field=title&field=event.type&field=project&field=user.display&field=timestamp&name=All%20Events&query=browser%3AFirefox%20title%3A%22Oh%20no%20something%20bad%22&sort=-timestamp&statsPeriod=24h&yAxis=count%28%29'
    );

    // Get the second link
    expect(screen.getByRole('link', {name: 'test-uuid'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/discover/homepage/?field=title&field=event.type&field=project&field=user.display&field=timestamp&name=All%20Events&query=tags%5Bdevice.uuid%5D%3Atest-uuid%20title%3A%22Oh%20no%20something%20bad%22&sort=-timestamp&statsPeriod=24h&yAxis=count%28%29'
    );

    // Get the third link
    expect(screen.getByRole('link', {name: '82ebf297206a'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/discover/homepage/?field=title&field=event.type&field=project&field=user.display&field=timestamp&name=All%20Events&query=release%3A82ebf297206a%20title%3A%22Oh%20no%20something%20bad%22&sort=-timestamp&statsPeriod=24h&yAxis=count%28%29'
    );
  });

  it('appends tag value to existing query when clicked', async function () {
    const {organization, routerContext} = initializeOrg({
      organization: TestStubs.Organization(),
      router: {
        location: {
          pathname: '/organizations/org-slug/discover/project-slug:deadbeef',
          query: {},
        },
      },
    });
    render(
      <EventDetails
        organization={organization}
        params={{eventSlug: 'project-slug:deadbeef'}}
        location={{
          query: {...allEventsView.generateQueryStringObject(), query: 'Dumpster'},
        }}
      />,
      {context: routerContext}
    );

    // Get the first link as we wrap react-router's link
    expect(await screen.findByText('Firefox')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Firefox'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/discover/results/?field=title&field=event.type&field=project&field=user.display&field=timestamp&name=All%20Events&query=Dumpster%20browser%3AFirefox%20title%3A%22Oh%20no%20something%20bad%22&sort=-timestamp&statsPeriod=24h&yAxis=count%28%29'
    );

    // Get the second link
    expect(screen.getByRole('link', {name: 'test-uuid'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/discover/results/?field=title&field=event.type&field=project&field=user.display&field=timestamp&name=All%20Events&query=Dumpster%20tags%5Bdevice.uuid%5D%3Atest-uuid%20title%3A%22Oh%20no%20something%20bad%22&sort=-timestamp&statsPeriod=24h&yAxis=count%28%29'
    );
    // Get the third link
    expect(screen.getByRole('link', {name: '82ebf297206a'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/discover/results/?field=title&field=event.type&field=project&field=user.display&field=timestamp&name=All%20Events&query=Dumpster%20release%3A82ebf297206a%20title%3A%22Oh%20no%20something%20bad%22&sort=-timestamp&statsPeriod=24h&yAxis=count%28%29'
    );
  });

  it('links back to the homepage if the query param contains homepage flag', async () => {
    const {organization, router, routerContext} = initializeOrg({
      organization: TestStubs.Organization({
        features: ['discover-query-builder-as-landing-page'],
      }),
      router: {
        location: {
          pathname: '/organizations/org-slug/discover/project-slug:deadbeef',
          query: {...allEventsView.generateQueryStringObject(), homepage: true},
        },
      },
    });

    render(
      <EventDetails
        organization={organization}
        params={{eventSlug: 'project-slug:deadbeef'}}
        location={router.location}
      />,
      {context: routerContext, organization}
    );

    expect((await screen.findByText('Discover')).pathname).toEqual(
      '/organizations/org-slug/discover/homepage/'
    );
  });
});
