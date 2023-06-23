import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import AlertWizard from 'sentry/views/alerts/wizard/index';

describe('AlertWizard', () => {
  it('sets crash free dataset to metrics', async () => {
    const {organization, project, routerProps, routerContext} = initializeOrg({
      organization: {
        features: [
          'alert-crash-free-metrics',
          'incidents',
          'performance-view',
          'crash-rate-alerts',
        ],
        access: ['org:write', 'alerts:write'],
      },
    });
    render(
      <AlertWizard
        organization={organization}
        projectId={project.slug}
        {...routerProps}
      />,
      {context: routerContext, organization}
    );

    await userEvent.click(screen.getByText('Crash Free Session Rate'));
    await userEvent.click(screen.getByText('Set Conditions'));
    expect(routerContext.context.router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/alerts/new/metric/',
      query: {
        aggregate:
          'percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate',
        dataset: 'metrics',
        eventTypes: 'session',
        project: 'project-slug',
        referrer: undefined,
      },
    });
  });
});
