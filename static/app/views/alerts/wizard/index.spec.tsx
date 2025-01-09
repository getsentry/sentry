import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import AlertWizard from 'sentry/views/alerts/wizard/index';

describe('AlertWizard', () => {
  beforeEach(() => {
    ConfigStore.init();
  });
  it('sets crash free dataset to metrics', async () => {
    const {organization, project, routerProps, router} = initializeOrg({
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
      {router, organization}
    );

    await userEvent.click(screen.getByText('Crash Free Session Rate'));
    await userEvent.click(screen.getByText('Set Conditions'));
    expect(router.push).toHaveBeenCalledWith({
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

  it('should render alerts for enabled features', () => {
    const {organization, project, routerProps, router} = initializeOrg({
      organization: {
        features: [
          'alert-crash-free-metrics',
          'incidents',
          'performance-view',
          'crash-rate-alerts',
          'insights-addon-modules',
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
      {router, organization}
    );

    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.getByText('Uptime Monitoring')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
    const alertGroups = screen.getAllByRole('radiogroup');
    expect(alertGroups).toHaveLength(5);
  });

  it('should only render alerts for errors in self-hosted errors only', () => {
    ConfigStore.set('isSelfHostedErrorsOnly', true);
    const {organization, project, routerProps, router} = initializeOrg({
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
      {router, organization}
    );

    expect(screen.getByText('Errors')).toBeInTheDocument();
    const alertGroups = screen.getAllByRole('radiogroup');
    expect(alertGroups).toHaveLength(1);
  });

  it('shows uptime alert according to feature flag', () => {
    const {organization, project, routerProps, router} = initializeOrg({
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
      {router, organization}
    );

    expect(screen.getByText('Uptime Monitor')).toBeInTheDocument();
  });
});
