import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {SeerWorkflowConfigFixture} from 'sentry-fixture/seerWorkflowConfig';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import AutomationDetail from 'sentry/views/seerWorkflows/automations/detail';
import type {SeerWorkflowConfigResponse} from 'sentry/views/seerWorkflows/types';

import AutomationConfiguration from './configuration';

describe('AutomationConfiguration', () => {
  const organization = OrganizationFixture({
    features: ['seer-automations', 'service-accounts'],
  });
  const detailRouterConfig = {
    location: {pathname: '/organizations/org-slug/seer/automations/42/'},
    route: '/organizations/:orgId/seer/automations/:automationId/',
    children: [{index: true, element: <AutomationConfiguration />}],
  };

  function mockConfig(config: SeerWorkflowConfigResponse) {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/configs/`,
      body: {configs: [config]},
    });
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/`,
      body: [],
    });
    ProjectsStore.loadInitialData([ProjectFixture({id: '1', slug: 'checkout-api'})]);
  });

  it('shows not found without an automation', () => {
    render(<AutomationConfiguration />, {organization});

    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
  });

  it('shows the Agentic Triage form for agentic triage automations', async () => {
    mockConfig(
      SeerWorkflowConfigFixture({id: '42', strategy: 'agentic_triage_v2', projects: [1]})
    );
    render(<AutomationDetail />, {organization, initialRouterConfig: detailRouterConfig});

    expect(await screen.findByText('Environments')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Connect monitors'})
    ).not.toBeInTheDocument();
  });

  it('shows the Breached Metric form for breached metric automations', async () => {
    mockConfig(
      SeerWorkflowConfigFixture({id: '42', strategy: 'breached_metric_investigation'})
    );
    render(<AutomationDetail />, {organization, initialRouterConfig: detailRouterConfig});

    expect(
      await screen.findByRole('button', {name: 'Connect monitors'})
    ).toBeInTheDocument();
    expect(screen.queryByText('Environments')).not.toBeInTheDocument();
  });

  it('says the strategy is not supported for any other strategy', async () => {
    mockConfig(SeerWorkflowConfigFixture({id: '42', strategy: 'custom_strategy'}));
    render(<AutomationDetail />, {organization, initialRouterConfig: detailRouterConfig});

    expect(
      await screen.findByText('Strategy custom_strategy not supported')
    ).toBeInTheDocument();
  });
});
