import {cleanup, mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
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
    const routerContext = TestStubs.routerContext([]);

    mountWithTheme(
      <EventDetails
        organization={organization}
        params={{orgId: organization.slug, eventSlug: `${project.slug}:${event.id}`}}
        location={routerContext.context.location}
      />
    );
    expect(screen.getByText(alertText)).toBeInTheDocument();
  });

  it('does not reender alert if already received transaction', () => {
    const project = TestStubs.Project({firstTransactionEvent: true});
    ProjectsStore.loadInitialData([project]);
    const organization = TestStubs.Organization({
      features: ['performance-view'],
      projects: [project],
    });
    const event = TestStubs.Event();
    const routerContext = TestStubs.routerContext([]);

    mountWithTheme(
      <EventDetails
        organization={organization}
        params={{orgId: organization.slug, eventSlug: `${project.slug}:${event.id}`}}
        location={routerContext.context.location}
      />
    );
    expect(screen.queryByText(alertText)).not.toBeInTheDocument();
  });
});
