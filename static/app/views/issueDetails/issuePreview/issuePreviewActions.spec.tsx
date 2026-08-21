import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';

import {IssuePreviewActions} from './issuePreviewActions';

// A completed root-cause run so the next step is "make a plan", which renders
// the coding-agent handoff dropdown.
function makeAutofix(
  overrides: Partial<ReturnType<typeof useExplorerAutofix>> = {}
): ReturnType<typeof useExplorerAutofix> {
  return {
    runState: {
      run_id: 1,
      status: 'completed',
      updated_at: '2026-01-01T00:00:00Z',
      blocks: [
        {
          id: 'b1',
          message: {role: 'assistant', content: 'done', metadata: {step: 'root_cause'}},
          timestamp: '2026-01-01T00:00:00Z',
          loading: false,
        },
      ],
    } as any,
    autofixFormatted: null,
    startStep: jest.fn(),
    createPR: jest.fn(),
    reset: jest.fn(),
    triggerCodingAgentHandoff: jest.fn(),
    codingAgentErrors: [],
    dismissCodingAgentError: jest.fn(),
    warnings: [],
    isLoading: false,
    isWaitingForRun: false,
    isPolling: false,
    ...overrides,
  };
}

describe('IssuePreviewActions', () => {
  const organization = OrganizationFixture();
  const group = GroupFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {pullRequests: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      body: {integrations: [{id: '9', name: 'Claude Agent', provider: 'claude_code'}]},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${group.project.slug}/seer/repos/`,
      body: [{provider: 'github'}],
    });
  });

  it('hands off to a coding agent from the shared dropdown', async () => {
    const autofix = makeAutofix();

    render(
      <IssuePreviewActions
        autofix={autofix}
        group={group}
        onContinueInSeer={jest.fn()}
      />,
      {organization}
    );

    await userEvent.click(
      await screen.findByRole('button', {name: 'More code fix options'})
    );
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'Send to Claude Agent'})
    );

    expect(autofix.triggerCodingAgentHandoff).toHaveBeenCalledWith(
      1,
      expect.objectContaining({provider: 'claude_code'})
    );
  });

  it('shows the Add Integration footer in the dropdown', async () => {
    render(
      <IssuePreviewActions
        autofix={makeAutofix()}
        group={group}
        onContinueInSeer={jest.fn()}
      />,
      {organization}
    );

    await userEvent.click(
      await screen.findByRole('button', {name: 'More code fix options'})
    );

    expect(await screen.findByRole('button', {name: 'Add Integration'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/integrations/?category=coding%20agent`
    );
  });
});
