import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {DetailedProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import GroupAutofix from 'sentry/views/issueDetails/autofix';
import {AutofixPanelProvider} from 'sentry/views/issueDetails/autofix/context';
import {GroupDataContextProvider} from 'sentry/views/issueDetails/groupDataContext';

describe('GroupAutofix', () => {
  const group = GroupFixture();
  const project = DetailedProjectFixture();
  const orgSlug = project.organization.slug;

  function renderPage(organization: Organization) {
    return render(
      <GroupDataContextProvider group={group} project={project}>
        <AutofixPanelProvider group={group} project={project}>
          <GroupAutofix />
        </AutofixPanelProvider>
      </GroupDataContextProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {pathname: `/organizations/${orgSlug}/issues/${group.id}/autofix/`},
          route: '/organizations/:orgId/issues/:groupId/autofix/',
        },
      }
    );
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    localStorage.clear();

    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/issues/${group.id}/autofix/setup/`,
      body: AutofixSetupFixture({integration: {ok: true, reason: null}}),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/issues/${group.id}/autofix/`,
      body: {autofix: null},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${orgSlug}/${project.slug}/seer/preferences/`,
      body: {code_mapping_repos: [], preference: null},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${orgSlug}/${project.slug}/`,
      body: {autofixAutomationTuning: 'off'},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/seer/setup-check/`,
      body: {
        hasFreeAutofixAccess: true,
        billing: {hasAutofixQuota: true, hasScannerQuota: true},
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/seer/onboarding-check/`,
      body: {
        hasSupportedScmIntegration: false,
        isAutofixEnabled: false,
        isCodeReviewEnabled: false,
        isSeerConfigured: false,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/integrations/coding-agents/`,
      body: {integrations: []},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${orgSlug}/${project.slug}/autofix-repos/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${orgSlug}/${project.slug}/seer/repos/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/issues/${group.id}/tags/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/group-search-views/starred/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/group-search-views/`,
      body: [],
    });
  });

  it('renders the autofix panel with the feature enabled', async () => {
    renderPage(
      OrganizationFixture({
        hideAiFeatures: false,
        features: ['gen-ai-features', 'autofix-page'],
      })
    );

    // The toolbar now lives in the issue navigation row, so the tab itself
    // renders only the analysis.
    expect(
      await screen.findByRole('button', {name: 'Start Analysis'})
    ).toBeInTheDocument();
    expect(screen.queryByText('Seer Autofix')).not.toBeInTheDocument();
  });

  it('offers the upgrade CTA when the org has no Seer subscription', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/seer/setup-check/`,
      body: {
        hasFreeAutofixAccess: false,
        billing: {hasAutofixQuota: false, hasScannerQuota: false},
      },
    });

    renderPage(
      OrganizationFixture({
        hideAiFeatures: false,
        features: ['gen-ai-features', 'autofix-page', 'seer-billing'],
      })
    );

    // Starting a run would only fail without a subscription, so the upgrade
    // region replaces the start card.
    expect(await screen.findByTestId('autofix-upgrade-cta')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Start Analysis'})
    ).not.toBeInTheDocument();
  });

  it('shows the start card when the org still has Autofix quota', async () => {
    renderPage(
      OrganizationFixture({
        hideAiFeatures: false,
        features: ['gen-ai-features', 'autofix-page', 'seer-billing'],
      })
    );

    expect(
      await screen.findByRole('button', {name: 'Start Analysis'})
    ).toBeInTheDocument();
    expect(screen.queryByTestId('autofix-upgrade-cta')).not.toBeInTheDocument();
  });

  it('redirects to issue details without the autofix-page feature', async () => {
    const {router} = renderPage(
      OrganizationFixture({hideAiFeatures: false, features: ['gen-ai-features']})
    );

    await waitFor(() => {
      expect(router.location.pathname).toBe(
        `/organizations/${orgSlug}/issues/${group.id}/`
      );
    });
  });

  it('redirects when AI features are hidden for the organization', async () => {
    const {router} = renderPage(
      OrganizationFixture({
        hideAiFeatures: true,
        features: ['gen-ai-features', 'autofix-page'],
      })
    );

    await waitFor(() => {
      expect(router.location.pathname).toBe(
        `/organizations/${orgSlug}/issues/${group.id}/`
      );
    });
  });
});
