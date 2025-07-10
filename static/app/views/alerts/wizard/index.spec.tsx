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
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
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
          'uptime',
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
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
    );

    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.getByText('Uptime Monitoring')).toBeInTheDocument();
    expect(screen.getByText('Cron Monitoring')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
    const alertGroups = screen.getAllByRole('radiogroup');
    expect(alertGroups).toHaveLength(6);
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
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
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
          'uptime',
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
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
    );

    expect(screen.getByText('Uptime Monitor')).toBeInTheDocument();
  });

  it('shows span aggregate alerts according to feature flag', async () => {
    const {organization, project, routerProps, router} = initializeOrg({
      organization: {
        features: [
          'alert-crash-free-metrics',
          'incidents',
          'performance-view',
          'crash-rate-alerts',
          'visibility-explore-view',
          'performance-transaction-deprecation-alerts',
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
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
    );

    await userEvent.click(screen.getByText('Throughput'));
    expect(
      screen.getByText(/Throughput is the total number of spans/)
    ).toBeInTheDocument();
  });

  it('hides logs aggregate alerts according to feature flag', () => {
    const {organization, project, routerProps, router} = initializeOrg({
      organization: {
        features: [
          'alert-crash-free-metrics',
          'incidents',
          'performance-view',
          'crash-rate-alerts',
          'visibility-explore-view',
          'performance-transaction-deprecation-alerts',
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
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
    );

    expect(screen.queryByText('Logs')).not.toBeInTheDocument();
  });

  it('shows logs aggregate alerts according to feature flag', () => {
    const {organization, project, routerProps, router} = initializeOrg({
      organization: {
        features: [
          'alert-crash-free-metrics',
          'incidents',
          'performance-view',
          'visibility-explore-view',
          'ourlogs-alerts',
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
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
    );

    expect(screen.getAllByText('Logs')).toHaveLength(2);
  });

  it('shows transaction aggregate alerts according to feature flag', async () => {
    const {organization, project, routerProps, router} = initializeOrg({
      organization: {
        features: [
          'alert-crash-free-metrics',
          'incidents',
          'performance-view',
          'crash-rate-alerts',
          'visibility-explore-view',
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
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
    );

    await userEvent.click(screen.getByText('Throughput'));
    expect(
      screen.getByText(/Throughput is the total number of transactions/)
    ).toBeInTheDocument();
  });
});
