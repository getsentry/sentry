import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import SeerAutomationSCMRequired from 'getsentry/views/seerAutomation/scmRequired';

describe('SeerAutomationSCMRequired', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('allows free Autofix access without a paid or trial plan', async () => {
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
        children: [
          {
            path: 'projects/',
            handle: {seerSection: 'autofix'},
            element: <div>Autofix projects</div>,
          },
        ],
      },
    });

    expect(await screen.findByText('Autofix projects')).toBeInTheDocument();
    expect(router.location.pathname).toBe(
      `/settings/${organization.slug}/seer/projects/`
    );
  });

  it('does not grant free access to Code Review settings', async () => {
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
        location: {pathname: `/settings/${organization.slug}/seer/repos/`},
        route: '/settings/:orgId/seer/',
        children: [{path: 'repos/', element: <div>Code Review repositories</div>}],
      },
    });

    await waitFor(() =>
      expect(router.location.pathname).toBe(`/settings/${organization.slug}/seer/trial/`)
    );
    expect(screen.queryByText('Code Review repositories')).not.toBeInTheDocument();
  });
});
