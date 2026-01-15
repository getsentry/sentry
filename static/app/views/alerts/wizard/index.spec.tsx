import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import AlertWizard from 'sentry/views/alerts/wizard/index';

describe('AlertWizard', () => {
  const project = ProjectFixture();

  beforeEach(() => {
    ConfigStore.init();
  });

  it('sets crash free dataset to metrics', async () => {
    const organization = OrganizationFixture({
      features: ['incidents', 'performance-view', 'crash-rate-alerts'],
      access: ['org:write', 'alerts:write'],
    });

    const {router} = render(<AlertWizard />, {
      organization,
      outletContext: {project, members: []},
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/alerts/wizard/',
          query: {project: project.slug},
        },
      },
    });

    await userEvent.click(screen.getByText('Crash Free Session Rate'));
    await userEvent.click(screen.getByText('Set Conditions'));
    expect(router.location.pathname).toBe(
      '/organizations/org-slug/issues/alerts/new/metric/'
    );
    expect(router.location.query).toEqual({
      aggregate: 'percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate',
      dataset: 'metrics',
      eventTypes: 'session',
      project: 'project-slug',
    });
  });

  it('should render alerts for enabled features', () => {
    const organization = OrganizationFixture({
      features: [
        'incidents',
        'performance-view',
        'crash-rate-alerts',
        'insight-modules',
        'uptime',
      ],
      access: ['org:write', 'alerts:write'],
    });

    render(<AlertWizard />, {
      organization,
      outletContext: {project, members: []},
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/alerts/wizard/',
          query: {project: project.slug},
        },
      },
    });

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
    const organization = OrganizationFixture({
      features: ['incidents', 'performance-view', 'crash-rate-alerts'],
      access: ['org:write', 'alerts:write'],
    });

    render(<AlertWizard />, {
      organization,
      outletContext: {project, members: []},
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/alerts/wizard/',
          query: {project: project.slug},
        },
      },
    });

    expect(screen.getByText('Errors')).toBeInTheDocument();
    const alertGroups = screen.getAllByRole('radiogroup');
    expect(alertGroups).toHaveLength(1);
  });

  it('shows uptime alert according to feature flag', () => {
    const organization = OrganizationFixture({
      features: ['incidents', 'performance-view', 'crash-rate-alerts', 'uptime'],
      access: ['org:write', 'alerts:write'],
    });

    render(<AlertWizard />, {
      organization,
      outletContext: {project, members: []},
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/alerts/wizard/',
          query: {project: project.slug},
        },
      },
    });

    expect(screen.getByText('Uptime Monitor')).toBeInTheDocument();
  });

  it('shows span aggregate alerts according to feature flag', async () => {
    const organization = OrganizationFixture({
      features: [
        'incidents',
        'performance-view',
        'crash-rate-alerts',
        'visibility-explore-view',
        'discover-saved-queries-deprecation',
      ],
      access: ['org:write', 'alerts:write'],
    });

    render(<AlertWizard />, {
      organization,
      outletContext: {project, members: []},
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/alerts/wizard/',
          query: {project: project.slug},
        },
      },
    });

    await userEvent.click(screen.getByText('Throughput'));
    expect(
      screen.getByText(/Throughput is the total number of spans/)
    ).toBeInTheDocument();
  });

  it('hides logs aggregate alerts according to feature flag', () => {
    const organization = OrganizationFixture({
      features: [
        'incidents',
        'performance-view',
        'crash-rate-alerts',
        'visibility-explore-view',
        'discover-saved-queries-deprecation',
      ],
      access: ['org:write', 'alerts:write'],
    });

    render(<AlertWizard />, {
      organization,
      outletContext: {project, members: []},
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/alerts/wizard/',
          query: {project: project.slug},
        },
      },
    });

    expect(screen.queryByText('Logs')).not.toBeInTheDocument();
  });

  it('shows logs aggregate alerts according to feature flag', () => {
    const organization = OrganizationFixture({
      features: [
        'incidents',
        'performance-view',
        'visibility-explore-view',
        'ourlogs-enabled',
      ],
      access: ['org:write', 'alerts:write'],
    });

    render(<AlertWizard />, {
      organization,
      outletContext: {project, members: []},
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/alerts/wizard/',
          query: {project: project.slug},
        },
      },
    });

    expect(screen.getAllByText('Logs')).toHaveLength(2);
  });

  it('shows transaction aggregate alerts according to feature flag', async () => {
    const organization = OrganizationFixture({
      features: [
        'incidents',
        'performance-view',
        'crash-rate-alerts',
        'visibility-explore-view',
      ],
      access: ['org:write', 'alerts:write'],
    });

    render(<AlertWizard />, {
      organization,
      outletContext: {project, members: []},
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/alerts/wizard/',
          query: {project: project.slug},
        },
      },
    });

    await userEvent.click(screen.getByText('Throughput'));
    expect(
      screen.getByText(/Throughput is the total number of transactions/)
    ).toBeInTheDocument();
  });
});
