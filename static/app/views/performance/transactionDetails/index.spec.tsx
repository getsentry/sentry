import {Event as EventFixture} from 'sentry-fixture/event';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import EventDetails from 'sentry/views/performance/transactionDetails';

const alertText =
  'You are viewing a sample transaction. Configure performance to start viewing real transactions.';

describe('EventDetails', () => {
  const project = ProjectFixture();
  const organization = Organization({
    features: ['performance-view'],
    projects: [project],
  });

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      statusCode: 200,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/latest/events/1/grouping-info/`,
      statusCode: 200,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/latest/events/1/committers/`,
      statusCode: 200,
      body: [],
    });
  });

  afterEach(() => {
    ProjectsStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('renders alert for sample transaction', async () => {
    const event = EventFixture();
    event.tags.push({key: 'sample_event', value: 'yes'});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/latest/`,
      statusCode: 200,
      body: {
        ...event,
      },
    });

    render(
      <EventDetails {...RouteComponentPropsFixture({params: {eventSlug: 'latest'}})} />,
      {organization}
    );
    expect(screen.getByText(alertText)).toBeInTheDocument();

    // Expect stores to be updated
    await act(tick);
  });

  it('does not reender alert if already received transaction', async () => {
    const event = EventFixture();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/latest/`,
      statusCode: 200,
      body: {
        ...event,
      },
    });

    render(
      <EventDetails {...RouteComponentPropsFixture({params: {eventSlug: 'latest'}})} />,
      {organization}
    );
    expect(screen.queryByText(alertText)).not.toBeInTheDocument();

    // Expect stores to be updated
    await act(tick);
  });
});
