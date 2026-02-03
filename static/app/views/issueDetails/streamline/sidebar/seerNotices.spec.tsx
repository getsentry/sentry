import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {SeerNotices} from 'sentry/views/issueDetails/streamline/sidebar/seerNotices';

describe('SeerNotices', () => {
  const createRepository = (overrides = {}) => ({
    external_id: 'repo-123',
    name: 'org/repo',
    owner: 'org',
    provider: 'github',
    provider_raw: 'github',
    is_readable: true,
    is_writeable: true,
    ...overrides,
  });

  function getProjectWithAutomation(
    automationTuning = 'off' as 'off' | 'low' | 'medium' | 'high' | 'always'
  ) {
    return {
      ...ProjectFixture(),
      autofixAutomationTuning: automationTuning,
      organization: {
        ...ProjectFixture().organization,
      },
    };
  }

  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${ProjectFixture().slug}/seer/preferences/`,
      body: {
        code_mapping_repos: [],
        preference: null,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/group-search-views/starred/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${ProjectFixture().slug}/autofix-repos/`,
      body: [createRepository()],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      body: {
        integrations: [],
      },
    });
  });

  it('shows automation step if automation is allowed and tuning is off', async () => {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/projects/${organization.slug}/${ProjectFixture().slug}/`,
      body: {
        autofixAutomationTuning: 'off',
      },
    });
    const project = {
      ...ProjectFixture(),
      organization: {
        ...ProjectFixture().organization,
        features: [],
      },
    };
    render(<SeerNotices groupId="123" hasGithubIntegration project={project} />, {
      organization,
    });
    await waitFor(() => {
      expect(screen.getByText('Unleash Automation')).toBeInTheDocument();
    });
  });

  it('shows fixability view step if automation is allowed and view not starred', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/group-search-views/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/projects/${organization.slug}/${ProjectFixture().slug}/`,
      body: {
        autofixAutomationTuning: 'medium',
      },
    });
    const project = getProjectWithAutomation('high');
    render(<SeerNotices groupId="123" hasGithubIntegration project={project} />, {
      organization: {
        ...organization,
        features: ['issue-views'],
      },
    });
    await waitFor(() => {
      expect(screen.getByText('Get Some Quick Wins')).toBeInTheDocument();
    });
  });

  it('shows cursor integration step if integration is installed but handoff not configured', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      body: {
        integrations: [
          {
            id: '123',
            provider: 'cursor',
            name: 'Cursor',
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${ProjectFixture().slug}/seer/preferences/`,
      body: {
        code_mapping_repos: [],
        preference: {
          repositories: [],
          automated_run_stopping_point: 'root_cause',
          // No automation_handoff - handoff is not configured
        },
      },
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/projects/${organization.slug}/${ProjectFixture().slug}/`,
      body: {
        autofixAutomationTuning: 'medium',
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/group-search-views/starred/`,
      body: [
        GroupSearchViewFixture({
          query: 'is:unresolved issue.seer_actionability:high',
          starred: true,
        }),
      ],
    });
    const project = getProjectWithAutomation('medium');
    render(<SeerNotices groupId="123" hasGithubIntegration project={project} />, {
      organization: {
        ...organization,
        features: ['integrations-cursor'],
      },
    });
    await waitFor(() => {
      expect(screen.getByText('Hand Off to Cursor Cloud Agents')).toBeInTheDocument();
    });
  });

  it('does not show cursor integration step if localStorage skip key is set', () => {
    // Set localStorage skip key
    localStorage.setItem(`seer-onboarding-cursor-skipped:${ProjectFixture().id}`, 'true');

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      body: {
        integrations: [
          {
            id: '123',
            provider: 'cursor',
            name: 'Cursor',
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/projects/${organization.slug}/${ProjectFixture().slug}/`,
      body: {
        autofixAutomationTuning: 'medium',
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/group-search-views/starred/`,
      body: [
        GroupSearchViewFixture({
          query: 'is:unresolved issue.seer_actionability:high',
          starred: true,
        }),
      ],
    });
    const project = getProjectWithAutomation('medium');
    render(<SeerNotices groupId="123" hasGithubIntegration project={project} />, {
      organization: {
        ...organization,
        features: ['integrations-cursor'],
      },
    });

    // Should not show the cursor step since it was skipped
    expect(screen.queryByText('Hand Off to Cursor Cloud Agents')).not.toBeInTheDocument();

    // Clean up localStorage
    localStorage.removeItem(`seer-onboarding-cursor-skipped:${ProjectFixture().id}`);
  });

  it('does not show cursor integration step if handoff is already configured', () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      body: {
        integrations: [
          {
            id: '123',
            provider: 'cursor',
            name: 'Cursor',
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${ProjectFixture().slug}/seer/preferences/`,
      body: {
        code_mapping_repos: [],
        preference: {
          repositories: [],
          automated_run_stopping_point: 'root_cause',
          automation_handoff: {
            handoff_point: 'root_cause',
            target: 'cursor_background_agent',
            integration_id: 123,
          },
        },
      },
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/projects/${organization.slug}/${ProjectFixture().slug}/`,
      body: {
        autofixAutomationTuning: 'medium',
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/group-search-views/starred/`,
      body: [
        GroupSearchViewFixture({
          query: 'is:unresolved issue.seer_actionability:high',
          starred: true,
        }),
      ],
    });
    const project = getProjectWithAutomation('medium');
    render(<SeerNotices groupId="123" hasGithubIntegration project={project} />, {
      organization: {
        ...organization,
        features: ['integrations-cursor'],
      },
    });

    // Should not show the cursor step since handoff is already configured
    expect(screen.queryByText('Hand Off to Cursor Cloud Agents')).not.toBeInTheDocument();
  });

  it('does not render guided steps if all onboarding steps are complete', () => {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/projects/${organization.slug}/${ProjectFixture().slug}/`,
      body: {
        autofixAutomationTuning: 'medium',
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/group-search-views/starred/`,
      body: [
        GroupSearchViewFixture({
          query: 'is:unresolved issue.seer_actionability:high',
          starred: true,
        }),
      ],
    });
    const project = getProjectWithAutomation('medium');
    render(<SeerNotices groupId="123" hasGithubIntegration project={project} />, {
      ...{
        organization,
      },
    });
    // Should not find any step titles
    expect(screen.queryByText('Set Up the GitHub Integration')).not.toBeInTheDocument();
    expect(screen.queryByText('Pick Repositories to Work In')).not.toBeInTheDocument();
    expect(screen.queryByText('Unleash Automation')).not.toBeInTheDocument();
    expect(screen.queryByText('Get Some Quick Wins')).not.toBeInTheDocument();
    expect(screen.queryByText('Hand Off to Cursor Cloud Agents')).not.toBeInTheDocument();
  });
});
