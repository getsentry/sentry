import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import SeerAutomationSCMRequired from 'getsentry/views/seerAutomation/scmRequired';

describe('SeerAutomationSCMRequired', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('allows free access without a paid or trial plan', async () => {
    const organization = OrganizationFixture({
      features: ['seer-user-billing-launch'],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/setup-check/`,
      body: {
        hasFreeAutofixAccess: true,
        billing: {hasAutofixQuota: false, hasScannerQuota: false},
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      query: {integrationType: 'source_code_management'},
      body: [],
    });

    const {router} = render(<SeerAutomationSCMRequired />, {
      organization,
      initialRouterConfig: {
        location: {pathname: `/settings/${organization.slug}/seer/projects/`},
        route: '/settings/:orgId/seer/',
        children: [{path: 'projects/', element: <div>Autofix projects</div>}],
      },
    });

    expect(await screen.findByText('Autofix projects')).toBeInTheDocument();
    expect(router.location.pathname).toBe(
      `/settings/${organization.slug}/seer/projects/`
    );
  });
});
