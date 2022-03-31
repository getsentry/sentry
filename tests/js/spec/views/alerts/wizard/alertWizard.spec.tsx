import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import AlertWizard from 'sentry/views/alerts/wizard/index';

describe('AlertWizard', () => {
  it('sets crash free dataset to metrics', () => {
    const {organization, project, router, routerContext} = initializeOrg({
      organization: {
        features: [
          'alert-crash-free-metrics',
          'incidents',
          'performance-view',
          'crash-rate-alerts',
        ],
        access: ['org:write', 'alerts:write'],
      },
      project: undefined,
      projects: undefined,
      router: undefined,
    });
    render(
      <AlertWizard
        organization={organization}
        project={project}
        route={{}}
        router={router}
        routes={router.routes}
        routeParams={router.params}
        location={router.location}
        params={{orgId: organization.slug, projectId: project.slug}}
      />,
      {context: routerContext, organization}
    );

    userEvent.click(screen.getByText('Crash Free Session Rate'));
    userEvent.click(screen.getByText('Set Conditions'));
    expect(routerContext.context.router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/alerts/project-slug/new/',
      query: {
        aggregate:
          'percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate',
        createFromWizard: true,
        dataset: 'metrics',
        eventTypes: 'session',
        referrer: undefined,
      },
    });
  });
});
