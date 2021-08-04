import {cleanup, mountWithTheme} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'app/stores/projectsStore';
import EventDetails from 'app/views/performance/transactionDetails';

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

    const {queryByText} = mountWithTheme(
      <EventDetails
        organization={organization}
        params={{orgId: organization.slug, eventSlug: `${project.slug}:${event.id}`}}
        location={routerContext.context.location}
      />,
      {context: routerContext}
    );
    expect(queryByText('Get Started')).toBeTruthy();
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

    const {queryByText} = mountWithTheme(
      <EventDetails
        organization={organization}
        params={{orgId: organization.slug, eventSlug: `${project.slug}:${event.id}`}}
        location={routerContext.context.location}
      />,
      {context: routerContext}
    );
    expect(queryByText('Get Started')).toBeNull();
  });
});
