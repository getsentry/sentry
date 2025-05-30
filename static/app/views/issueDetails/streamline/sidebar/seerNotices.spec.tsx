import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {SeerNotices} from 'sentry/views/issueDetails/streamline/sidebar/seerNotices';

describe('SeerNotices', function () {
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
        features: ['trigger-autofix-on-issue-summary'],
      },
    };
  }

  const organization = OrganizationFixture({
    features: ['trigger-autofix-on-issue-summary'],
  });

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
      organization: {
        ...organization,
        features: ['trigger-autofix-on-issue-summary'],
      },
    });
    await waitFor(() => {
      expect(screen.getByText('Unleash Automation')).toBeInTheDocument();
    });
  });

  it('does not show automation step if automation is not allowed', () => {
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
      organization: {...organization, features: []},
    });
    expect(screen.queryByText('Unleash Automation')).not.toBeInTheDocument();
  });

  it('shows fixability view step if automation is allowed and view not starred', () => {
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
        features: ['issue-stream-custom-views', 'trigger-autofix-on-issue-summary'],
      },
    });
    expect(screen.getByText('Get Some Quick Wins')).toBeInTheDocument();
    expect(screen.getByText('Star Recommended View')).toBeInTheDocument();
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
        organization: {
          ...organization,
          features: ['trigger-autofix-on-issue-summary'],
        },
      },
    });
    // Should not find any step titles
    expect(screen.queryByText('Set Up the GitHub Integration')).not.toBeInTheDocument();
    expect(screen.queryByText('Pick Repositories to Work In')).not.toBeInTheDocument();
    expect(screen.queryByText('Unleash Automation')).not.toBeInTheDocument();
    expect(screen.queryByText('Get Some Quick Wins')).not.toBeInTheDocument();
  });
});
