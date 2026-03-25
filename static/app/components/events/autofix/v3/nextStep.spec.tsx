import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DiffFileType, DiffLineType} from 'sentry/components/events/autofix/types';
import type {
  AutofixSection,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {ExplorerFilePatch} from 'sentry/views/seerExplorer/types';

import {SeerDrawerNextStep} from './nextStep';

function makeAutofix(
  overrides: Partial<ReturnType<typeof useExplorerAutofix>> = {}
): ReturnType<typeof useExplorerAutofix> {
  return {
    runState: {run_id: 1} as any,
    startStep: jest.fn(),
    createPR: jest.fn(),
    sendMessage: jest.fn(),
    reset: jest.fn(),
    triggerCodingAgentHandoff: jest.fn(),
    isLoading: false,
    isPolling: false,
    isReady: true,
    isStreaming: false,
    ...overrides,
  } as ReturnType<typeof useExplorerAutofix>;
}

function defaultArtifacts(step: string): AutofixSection['artifacts'] {
  switch (step) {
    case 'root_cause':
      return [
        {
          key: 'root_cause',
          reason: 'test',
          data: {one_line_description: 'desc', five_whys: ['why']},
        },
      ];
    case 'solution':
      return [
        {
          key: 'solution',
          reason: 'test',
          data: {one_line_summary: 'summary', steps: [{title: 't', description: 'd'}]},
        },
      ];
    case 'code_changes': {
      const codeChange: ExplorerFilePatch = {
        repo_name: 'repo',
        diff: 'diff content',
        patch: {
          added: 1,
          removed: 0,
          path: 'file.py',
          source_file: 'file.py',
          target_file: 'file.py',
          type: DiffFileType.MODIFIED,
          hunks: [
            {
              section_header: '@@ -1,1 +1,2 @@',
              source_start: 1,
              source_length: 1,
              target_start: 1,
              target_length: 2,
              lines: [
                {
                  diff_line_no: 1,
                  line_type: DiffLineType.ADDED,
                  source_line_no: null,
                  target_line_no: 1,
                  value: 'new line',
                },
              ],
            },
          ],
        },
      };
      return [[codeChange]];
    }
    default:
      return [];
  }
}

function makeSection(
  step: string,
  artifacts?: AutofixSection['artifacts']
): AutofixSection {
  return {
    step,
    artifacts: artifacts ?? defaultArtifacts(step),
    messages: [],
    status: 'completed',
  };
}

describe('SeerDrawerNextStep', () => {
  it('returns null when no runId', () => {
    const autofix = makeAutofix({runState: null});
    const {container} = render(
      <SeerDrawerNextStep group={GroupFixture()} sections={[]} autofix={autofix} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when sections are empty', () => {
    const autofix = makeAutofix();
    const {container} = render(
      <SeerDrawerNextStep group={GroupFixture()} sections={[]} autofix={autofix} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  describe('RootCauseNextStep', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/coding-agents/',
        body: {integrations: []},
      });
    });

    it('returns null when section has no artifacts', () => {
      const autofix = makeAutofix();
      const {container} = render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('root_cause', [])]}
          autofix={autofix}
        />
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('renders prompt and yes button', () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('root_cause')]}
          autofix={autofix}
        />
      );
      expect(screen.getByText('Are you happy with this root cause?')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'No'})).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Yes, make an implementation plan'})
      ).toBeInTheDocument();
    });

    it('calls startStep with solution on yes click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('root_cause')]}
          autofix={autofix}
        />
      );
      await userEvent.click(
        screen.getByRole('button', {name: 'Yes, make an implementation plan'})
      );
      expect(autofix.startStep).toHaveBeenCalledWith('solution', 1);
    });

    it('shows feedback UI on no click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('root_cause')]}
          autofix={autofix}
        />
      );
      await userEvent.click(screen.getByRole('button', {name: 'No'}));
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Rethink root cause'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Nevermind, make an implementation plan'})
      ).toBeInTheDocument();
    });

    it('calls startStep with root_cause and feedback on rethink click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('root_cause')]}
          autofix={autofix}
        />
      );
      await userEvent.click(screen.getByRole('button', {name: 'No'}));
      await userEvent.type(screen.getByRole('textbox'), 'Try a different approach');
      await userEvent.click(screen.getByRole('button', {name: 'Rethink root cause'}));
      expect(autofix.startStep).toHaveBeenCalledWith(
        'root_cause',
        1,
        'Try a different approach'
      );
    });

    it('proceeds like yes on nevermind click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('root_cause')]}
          autofix={autofix}
        />
      );
      await userEvent.click(screen.getByRole('button', {name: 'No'}));
      await userEvent.click(
        screen.getByRole('button', {name: 'Nevermind, make an implementation plan'})
      );
      expect(autofix.startStep).toHaveBeenCalledWith('solution', 1);
    });

    it('shows coding agent dropdown when integrations exist', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/coding-agents/',
        body: {
          integrations: [
            {id: '1', name: 'Copilot', provider: 'github', requires_identity: false},
          ],
        },
      });
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('root_cause')]}
          autofix={autofix}
        />
      );
      expect(
        await screen.findByRole('button', {name: 'More code fix options'})
      ).toBeInTheDocument();
    });

    it('shows Add Integration link in dropdown footer', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/coding-agents/',
        body: {
          integrations: [
            {id: '1', name: 'Copilot', provider: 'github', requires_identity: false},
          ],
        },
      });
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('root_cause')]}
          autofix={autofix}
        />
      );
      await userEvent.click(
        await screen.findByRole('button', {name: 'More code fix options'})
      );
      const addIntegrationLink = screen.getByRole('button', {name: 'Add Integration'});
      expect(addIntegrationLink).toHaveAttribute(
        'href',
        '/settings/org-slug/integrations/?category=coding%20agent'
      );
    });
  });

  describe('SolutionNextStep', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/coding-agents/',
        body: {integrations: []},
      });
    });
    it('returns null when section has no artifacts', () => {
      const autofix = makeAutofix();
      const {container} = render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('solution', [])]}
          autofix={autofix}
        />
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('renders prompt and yes button', () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('solution')]}
          autofix={autofix}
        />
      );
      expect(
        screen.getByText('Are you happy with this implementation plan?')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'No'})).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Yes, write a code fix'})
      ).toBeInTheDocument();
    });

    it('calls startStep with code_changes on yes click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('solution')]}
          autofix={autofix}
        />
      );
      await userEvent.click(screen.getByRole('button', {name: 'Yes, write a code fix'}));
      expect(autofix.startStep).toHaveBeenCalledWith('code_changes', 1);
    });

    it('shows feedback UI on no click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('solution')]}
          autofix={autofix}
        />
      );
      await userEvent.click(screen.getByRole('button', {name: 'No'}));
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Rethink implementation plan'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Nevermind, write a code fix'})
      ).toBeInTheDocument();
    });

    it('calls startStep with solution and feedback on rethink click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('solution')]}
          autofix={autofix}
        />
      );
      await userEvent.click(screen.getByRole('button', {name: 'No'}));
      await userEvent.type(screen.getByRole('textbox'), 'Consider edge cases');
      await userEvent.click(
        screen.getByRole('button', {name: 'Rethink implementation plan'})
      );
      expect(autofix.startStep).toHaveBeenCalledWith(
        'solution',
        1,
        'Consider edge cases'
      );
    });

    it('proceeds like yes on nevermind click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('solution')]}
          autofix={autofix}
        />
      );
      await userEvent.click(screen.getByRole('button', {name: 'No'}));
      await userEvent.click(
        screen.getByRole('button', {name: 'Nevermind, write a code fix'})
      );
      expect(autofix.startStep).toHaveBeenCalledWith('code_changes', 1);
    });

    it('shows coding agent dropdown when integrations exist', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/coding-agents/',
        body: {
          integrations: [
            {id: '1', name: 'Copilot', provider: 'github', requires_identity: false},
          ],
        },
      });
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('solution')]}
          autofix={autofix}
        />
      );
      expect(
        await screen.findByRole('button', {name: 'More code fix options'})
      ).toBeInTheDocument();
    });

    it('calls triggerCodingAgentHandoff when coding agent option is clicked', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/coding-agents/',
        body: {
          integrations: [
            {id: '1', name: 'Copilot', provider: 'github', requires_identity: false},
          ],
        },
      });
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('solution')]}
          autofix={autofix}
        />
      );
      await userEvent.click(
        await screen.findByRole('button', {name: 'More code fix options'})
      );
      await userEvent.click(screen.getByText('Send to Copilot'));
      expect(autofix.triggerCodingAgentHandoff).toHaveBeenCalledWith(1, {
        id: '1',
        name: 'Copilot',
        provider: 'github',
        requires_identity: false,
      });
    });
  });

  describe('CodeChangesNextStep', () => {
    it('returns null when section has no artifacts', () => {
      const autofix = makeAutofix();
      const {container} = render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('code_changes', [])]}
          autofix={autofix}
        />
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('renders prompt and yes button', () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('code_changes')]}
          autofix={autofix}
        />
      );
      expect(
        screen.getByText('Are you happy with these code changes?')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'No'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Yes, draft a PR'})).toBeInTheDocument();
    });

    it('calls createPR on yes click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('code_changes')]}
          autofix={autofix}
        />
      );
      await userEvent.click(screen.getByRole('button', {name: 'Yes, draft a PR'}));
      expect(autofix.createPR).toHaveBeenCalledWith(1);
    });

    it('shows feedback UI on no click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('code_changes')]}
          autofix={autofix}
        />
      );
      await userEvent.click(screen.getByRole('button', {name: 'No'}));
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Rethink code changes'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Nevermind, draft a PR'})
      ).toBeInTheDocument();
    });

    it('calls startStep with code_changes and feedback on rethink click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('code_changes')]}
          autofix={autofix}
        />
      );
      await userEvent.click(screen.getByRole('button', {name: 'No'}));
      await userEvent.type(screen.getByRole('textbox'), 'Fix the error handling');
      await userEvent.click(screen.getByRole('button', {name: 'Rethink code changes'}));
      expect(autofix.startStep).toHaveBeenCalledWith(
        'code_changes',
        1,
        'Fix the error handling'
      );
    });

    it('proceeds like yes on nevermind click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('code_changes')]}
          autofix={autofix}
        />
      );
      await userEvent.click(screen.getByRole('button', {name: 'No'}));
      await userEvent.click(screen.getByRole('button', {name: 'Nevermind, draft a PR'}));
      expect(autofix.createPR).toHaveBeenCalledWith(1);
    });

    it('does not show coding agent dropdown', () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/coding-agents/',
        body: {
          integrations: [
            {id: '1', name: 'Copilot', provider: 'github', requires_identity: false},
          ],
        },
      });
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('code_changes')]}
          autofix={autofix}
        />
      );
      expect(
        screen.queryByRole('button', {name: 'More code fix options'})
      ).not.toBeInTheDocument();
    });
  });
});
