import {cleanup, render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {OrganizationContext} from 'sentry/views/organizationContext';
import EventDetails from 'sentry/views/performance/transactionDetails';

const alertText =
  'You are viewing a sample transaction. Configure performance to start viewing real transactions.';

describe('EventDetails', () => {
  afterEach(cleanup);

  it('renders alert for sample transaction', () => {
    const project = TestStubs.Project();
    ProjectsStore.loadInitialData([project]);
    const organization = TestStubs.Organization({
      features: ['performance-view'],
      projects: [project],
    });
    const event = TestStubs.Event();
    event.tags.push({key: 'sample_event', value: 'yes'});
    const routerContext = TestStubs.routerContext([]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/latest/`,
      statusCode: 200,
      body: {
        ...event,
      },
    });

    render(
      <OrganizationContext.Provider value={organization}>
        <EventDetails
          organization={organization}
          params={{orgId: organization.slug, eventSlug: 'latest'}}
          location={routerContext.context.location}
        />
      </OrganizationContext.Provider>
    );
    expect(screen.getByText(alertText)).toBeInTheDocument();
  });

  it('does not reender alert if already received transaction', () => {
    const project = TestStubs.Project();
    ProjectsStore.loadInitialData([project]);
    const organization = TestStubs.Organization({
      features: ['performance-view'],
      projects: [project],
    });
    const event = TestStubs.Event();
    const routerContext = TestStubs.routerContext([]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/latest/`,
      statusCode: 200,
      body: {
        ...event,
      },
    });

    render(
      <OrganizationContext.Provider value={organization}>
        <EventDetails
          organization={organization}
          params={{orgId: organization.slug, eventSlug: 'latest'}}
          location={routerContext.context.location}
        />
      </OrganizationContext.Provider>
    );
    expect(screen.queryByText(alertText)).not.toBeInTheDocument();
  });
});
