import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';
import {OverviewCardAction} from 'sentry/views/seerWorkflows/overview/overviewCardAction';
import type {
  OverviewRun,
  OverviewRunIssue,
  ProjectConfig,
} from 'sentry/views/seerWorkflows/overview/types';

jest.mock('sentry/utils/analytics');

describe('OverviewCardAction', () => {
  const organization = OrganizationFixture();

  function issueFixture(): OverviewRunIssue {
    return {
      ...GroupFixture(),
      count: '10',
      userCount: 2,
      owners: [],
      substatus: 'ongoing',
      project: {id: '2', slug: 'project-slug', platform: 'python'},
    };
  }

  function runFixture(overrides: Partial<OverviewRun> = {}): OverviewRun {
    return {
      groupId: '2',
      shortId: 'PROJ-1',
      title: 'TypeError in checkout cart',
      rootCause: {oneLineDescription: 'The cart total is read before it is set.'},
      proposedFix: null,
      seerRunId: 'run-1',
      lastTriggeredAt: '2026-07-14T09:00:00Z',
      pullRequests: [],
      status: null,
      issue: issueFixture(),
      ...overrides,
    };
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/coding-agents/',
      body: {
        integrations: [{id: '123', name: 'Claude Agent', provider: 'claude_code'}],
      },
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/seer/repos/',
      body: [{provider: 'github'}],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/2/autofix/repos/',
      body: {repos: [{has_write_access: true, integration_id: 5}]},
    });
  });

  it.each([
    {
      sectionKey: 'needs_investigation',
      label: 'Create Plan',
      busyLabel: /Creating Plan/,
      step: 'solution',
      action: 'create_plan',
    },
    {
      sectionKey: 'solution_ready',
      label: 'Generate code',
      busyLabel: /Generating Code/,
      step: 'code_changes',
      action: 'generate_code',
    },
    {
      sectionKey: 'code_changes_ready',
      label: 'Draft PR',
      busyLabel: /Creating PR/,
      step: 'open_pr',
      action: 'draft_pr',
    },
  ] as const)(
    'dispatches the $action action and shows a busy button',
    async ({sectionKey, label, busyLabel, step, action}) => {
      const postRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/2/autofix/',
        method: 'POST',
        body: {run_id: 1, sentry_run_id: 'run-1'},
      });

      render(<OverviewCardAction run={runFixture()} sectionKey={sectionKey} />, {
        organization,
      });

      await userEvent.click(screen.getByRole('button', {name: label}));

      expect(postRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/issues/2/autofix/',
        expect.objectContaining({
          data: expect.objectContaining({step, sentry_run_id: 'run-1'}),
        })
      );

      expect(await screen.findByRole('button', {name: busyLabel})).toBeDisabled();
      expect(
        screen.queryByRole('button', {name: 'More Seer options'})
      ).not.toBeInTheDocument();

      expect(trackAnalytics).toHaveBeenCalledWith(
        'autofix.overview.action_clicked',
        expect.objectContaining({
          organization,
          group_id: '2',
          run_id: 'run-1',
          action,
        })
      );
    }
  );

  it('routes a Draft PR card to grant permissions when write access is missing', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/2/autofix/repos/',
      body: {repos: [{has_write_access: false, integration_id: 42}]},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/42/',
      body: GitHubIntegrationFixture({externalId: '654321', accountType: ''}),
    });
    const postRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/2/autofix/',
      method: 'POST',
      body: {},
    });

    render(<OverviewCardAction run={runFixture()} sectionKey="code_changes_ready" />, {
      organization,
    });

    const permissionsLink = await screen.findByRole('button', {name: /permissions/i});
    expect(permissionsLink).toHaveAttribute(
      'href',
      expect.stringContaining('/permissions/update')
    );
    expect(screen.queryByRole('button', {name: 'Draft PR'})).not.toBeInTheDocument();
    expect(postRequest).not.toHaveBeenCalled();
  });

  it('disables the Draft PR button until the write-access gate resolves', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/2/autofix/repos/',
      body: {repos: [{has_write_access: true, integration_id: 5}]},
      asyncDelay: 20,
    });

    render(<OverviewCardAction run={runFixture()} sectionKey="code_changes_ready" />, {
      organization,
    });

    expect(screen.getByRole('button', {name: 'Draft PR'})).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Draft PR'})).toBeEnabled()
    );
  });

  it('restores the action button when the trigger fails', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/2/autofix/',
      method: 'POST',
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    render(<OverviewCardAction run={runFixture()} sectionKey="needs_investigation" />, {
      organization,
    });

    await userEvent.click(screen.getByRole('button', {name: 'Create Plan'}));

    expect(await screen.findByRole('button', {name: 'Create Plan'})).toBeEnabled();
  });

  it('opens the Seer drawer in place from the dropdown without leaving the overview', async () => {
    render(<OverviewCardAction run={runFixture()} sectionKey="needs_investigation" />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/autofix/',
          query: {statsPeriod: '24h'},
        },
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'More Seer options'}));

    const openSeer = await screen.findByRole('menuitemradio', {name: 'Open Seer'});
    const href = openSeer.getAttribute('href') ?? '';
    expect(href).toContain('/organizations/org-slug/issues/autofix/');
    expect(href).toContain('seerDrawer=2');
    expect(href).toContain('statsPeriod=24h');
    expect(href).not.toContain('/issues/2/');

    expect(trackAnalytics).not.toHaveBeenCalledWith(
      'autofix.overview.action_clicked',
      expect.anything()
    );
  });

  it('hands off to a coding agent from the dropdown', async () => {
    const postRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/2/autofix/',
      method: 'POST',
      body: {failures: [], successes: [{}]},
    });

    render(<OverviewCardAction run={runFixture()} sectionKey="needs_investigation" />, {
      organization,
    });

    await userEvent.click(screen.getByRole('button', {name: 'More Seer options'}));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'Send to Claude Agent'})
    );

    await waitFor(() => {
      expect(postRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/issues/2/autofix/',
        expect.objectContaining({
          data: expect.objectContaining({
            step: 'coding_agent_handoff',
            integration_id: 123,
            sentry_run_id: 'run-1',
          }),
        })
      );
    });

    expect(trackAnalytics).toHaveBeenCalledWith(
      'coding_integration.send_to_agent_clicked',
      expect.objectContaining({provider: 'claude_code', source: 'overview'})
    );
  });

  it('defers coding agent fetches until the dropdown is opened', async () => {
    const agentsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/coding-agents/',
      body: {
        integrations: [{id: '123', name: 'Claude Agent', provider: 'claude_code'}],
      },
    });
    const reposRequest = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/seer/repos/',
      body: [{provider: 'github'}],
    });

    render(<OverviewCardAction run={runFixture()} sectionKey="needs_investigation" />, {
      organization,
    });

    expect(agentsRequest).not.toHaveBeenCalled();
    expect(reposRequest).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: 'More Seer options'}));

    expect(
      await screen.findByRole('menuitemradio', {name: 'Send to Claude Agent'})
    ).toBeInTheDocument();
    expect(agentsRequest).toHaveBeenCalled();
    expect(reposRequest).toHaveBeenCalled();
  });

  it('disables agent handoff without a connected GitHub repo', async () => {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/seer/repos/',
      body: [{provider: 'bitbucket'}],
    });

    render(<OverviewCardAction run={runFixture()} sectionKey="needs_investigation" />, {
      organization,
    });

    await userEvent.click(screen.getByRole('button', {name: 'More Seer options'}));

    const agentItem = await screen.findByRole('menuitemradio', {
      name: 'Send to Claude Agent',
    });
    expect(agentItem).toHaveAttribute('aria-disabled', 'true');
  });

  function projectConfigFixture(
    hasReposConnected: boolean,
    hasNonGithubRepo: boolean
  ): ProjectConfig {
    return {id: '2', slug: 'project-slug', hasReposConnected, hasNonGithubRepo};
  }

  it('uses precomputed repo eligibility and skips the repos fetch', async () => {
    const reposRequest = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/seer/repos/',
      body: [{provider: 'github'}],
    });

    render(
      <OverviewCardAction
        run={runFixture()}
        sectionKey="needs_investigation"
        projectConfig={projectConfigFixture(true, false)}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'More Seer options'}));

    const agentItem = await screen.findByRole('menuitemradio', {
      name: 'Send to Claude Agent',
    });
    expect(agentItem).not.toHaveAttribute('aria-disabled', 'true');
    expect(reposRequest).not.toHaveBeenCalled();
  });

  it('disables handoff from precomputed eligibility without fetching repos', async () => {
    const reposRequest = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/seer/repos/',
      body: [{provider: 'github'}],
    });

    render(
      <OverviewCardAction
        run={runFixture()}
        sectionKey="needs_investigation"
        projectConfig={projectConfigFixture(false, false)}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'More Seer options'}));

    const agentItem = await screen.findByRole('menuitemradio', {
      name: 'Send to Claude Agent',
    });
    expect(agentItem).toHaveAttribute('aria-disabled', 'true');
    expect(reposRequest).not.toHaveBeenCalled();
  });

  it('shows a loading state before revealing all options at once', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/coding-agents/',
      body: {
        integrations: [{id: '123', name: 'Claude Agent', provider: 'claude_code'}],
      },
      asyncDelay: 50,
    });

    render(
      <OverviewCardAction
        run={runFixture()}
        sectionKey="needs_investigation"
        projectConfig={projectConfigFixture(true, false)}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'More Seer options'}));

    expect(
      screen.queryByRole('menuitemradio', {name: 'Open Seer'})
    ).not.toBeInTheDocument();

    expect(
      await screen.findByRole('menuitemradio', {name: 'Open Seer'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: 'Send to Claude Agent'})
    ).toBeInTheDocument();
  });
});
