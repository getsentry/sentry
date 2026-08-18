import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';
import {OverviewCardAction} from 'sentry/views/seerWorkflows/overview/overviewCardAction';
import type {
  OverviewRun,
  OverviewRunIssue,
} from 'sentry/views/seerWorkflows/overview/types';

jest.mock('sentry/utils/analytics');

describe('OverviewCardAction', () => {
  const organization = OrganizationFixture();
  const issueUrl = '/organizations/org-slug/issues/2/';

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
  });

  it('triggers the plan step and shows a busy button', async () => {
    const postRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/2/autofix/',
      method: 'POST',
      body: {run_id: 1, sentry_run_id: 'run-1'},
    });

    render(
      <OverviewCardAction
        run={runFixture()}
        sectionKey="needs_investigation"
        issueUrl={issueUrl}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Create Plan'}));

    expect(postRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/2/autofix/',
      expect.objectContaining({
        method: 'POST',
        query: {mode: 'explorer'},
        data: expect.objectContaining({
          step: 'solution',
          sentry_run_id: 'run-1',
          referrer: 'api.web',
        }),
      })
    );

    expect(await screen.findByRole('button', {name: /Creating Plan/})).toBeDisabled();
    expect(
      screen.queryByRole('button', {name: 'More Seer options'})
    ).not.toBeInTheDocument();

    expect(trackAnalytics).toHaveBeenCalledWith(
      'autofix.overview.action_clicked',
      expect.objectContaining({
        organization,
        group_id: '2',
        run_id: 'run-1',
        action: 'create_plan',
      })
    );
  });

  it('triggers the code changes step from a solution card', async () => {
    const postRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/2/autofix/',
      method: 'POST',
      body: {run_id: 1, sentry_run_id: 'run-1'},
    });

    render(
      <OverviewCardAction
        run={runFixture()}
        sectionKey="solution_ready"
        issueUrl={issueUrl}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Generate code'}));

    expect(postRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/2/autofix/',
      expect.objectContaining({
        data: expect.objectContaining({step: 'code_changes', sentry_run_id: 'run-1'}),
      })
    );
    expect(await screen.findByRole('button', {name: /Generating Code/})).toBeDisabled();
  });

  it('drafts a PR from a code changes card', async () => {
    const postRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/2/autofix/',
      method: 'POST',
      body: {run_id: 1, sentry_run_id: 'run-1'},
    });

    render(
      <OverviewCardAction
        run={runFixture()}
        sectionKey="code_changes_ready"
        issueUrl={issueUrl}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Draft PR'}));

    expect(postRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/2/autofix/',
      expect.objectContaining({
        data: expect.objectContaining({step: 'open_pr', sentry_run_id: 'run-1'}),
      })
    );
    expect(await screen.findByRole('button', {name: /Creating PR/})).toBeDisabled();
  });

  it('restores the action button when the trigger fails', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/2/autofix/',
      method: 'POST',
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    render(
      <OverviewCardAction
        run={runFixture()}
        sectionKey="needs_investigation"
        issueUrl={issueUrl}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Create Plan'}));

    expect(await screen.findByRole('button', {name: 'Create Plan'})).toBeEnabled();
  });

  it('links to the issue with the Seer drawer open from the dropdown', async () => {
    render(
      <OverviewCardAction
        run={runFixture()}
        sectionKey="needs_investigation"
        issueUrl={issueUrl}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'More Seer options'}));

    const openSeer = await screen.findByRole('menuitemradio', {name: 'Open Seer'});
    expect(openSeer).toHaveAttribute(
      'href',
      expect.stringContaining('/organizations/org-slug/issues/2/?seerDrawer=true')
    );

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

    render(
      <OverviewCardAction
        run={runFixture()}
        sectionKey="needs_investigation"
        issueUrl={issueUrl}
      />,
      {organization}
    );

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

  it('shows the add integration link in the dropdown footer', async () => {
    render(
      <OverviewCardAction
        run={runFixture()}
        sectionKey="needs_investigation"
        issueUrl={issueUrl}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'More Seer options'}));

    expect(await screen.findByRole('button', {name: 'Add Integration'})).toHaveAttribute(
      'href',
      '/settings/org-slug/integrations/?category=coding%20agent'
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

    render(
      <OverviewCardAction
        run={runFixture()}
        sectionKey="needs_investigation"
        issueUrl={issueUrl}
      />,
      {organization}
    );

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

    render(
      <OverviewCardAction
        run={runFixture()}
        sectionKey="needs_investigation"
        issueUrl={issueUrl}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'More Seer options'}));

    const agentItem = await screen.findByRole('menuitemradio', {
      name: 'Send to Claude Agent',
    });
    expect(agentItem).toHaveAttribute('aria-disabled', 'true');
  });
});
