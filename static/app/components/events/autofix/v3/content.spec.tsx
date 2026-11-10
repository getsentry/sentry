import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {
  ExplorerAutofixState,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {useAiConfig} from 'sentry/views/issueDetails/hooks/useAiConfig';

import {SeerDrawerContent} from './content';

const mockOpenSeerExplorer = jest.fn();
const mockCloseSeerExplorer = jest.fn();
const mockChatDispatch = jest.fn();
let mockIsOpen = false;
let mockChatRunId: number | null = null;
jest.mock('sentry/views/seerExplorer/useSeerExplorerContext', () => ({
  ...jest.requireActual('sentry/views/seerExplorer/useSeerExplorerContext'),
  useSeerExplorerContext: () => ({
    openSeerExplorer: mockOpenSeerExplorer,
    closeSeerExplorer: mockCloseSeerExplorer,
    isOpen: mockIsOpen,
  }),
}));
jest.mock('sentry/views/seerExplorer/seerExplorerChatStateContext', () => ({
  ...jest.requireActual('sentry/views/seerExplorer/seerExplorerChatStateContext'),
  useSeerExplorerChatState: () => ({runId: mockChatRunId, chatStates: {}}),
  useSeerExplorerChatDispatch: () => mockChatDispatch,
}));

function makeAutofix(
  overrides: Partial<ReturnType<typeof useExplorerAutofix>> = {}
): ReturnType<typeof useExplorerAutofix> {
  return {
    runState: null,
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
    isProcessing: false,
    ...overrides,
  };
}

function makeAiConfig(
  overrides: Partial<ReturnType<typeof useAiConfig>> = {}
): ReturnType<typeof useAiConfig> {
  return {
    areAiFeaturesAllowed: true,
    hasAutofix: true,
    hasAutofixQuota: true,
    hasGithubIntegration: true,
    hasResources: false,
    hasSummary: true,
    isAutofixSetupLoading: false,
    orgNeedsGenAiAcknowledgement: false,
    refetchAutofixSetup: jest.fn(),
    seerReposLinked: true,
    ...overrides,
  };
}

describe('SeerDrawerContent', () => {
  it('allows starting Autofix when no run exists', async () => {
    const startStep = jest.fn().mockResolvedValue({runId: 1, isSingleRun: false});

    render(
      <SeerDrawerContent
        aiConfig={makeAiConfig()}
        autofix={makeAutofix({startStep})}
        group={GroupFixture()}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Start Analysis'}));

    expect(startStep).toHaveBeenCalledWith('root_cause');
  });

  describe('single runs', () => {
    const singleRun: ExplorerAutofixState = {
      run_id: 776,
      feature_id: 'autofix_single_run',
      status: 'completed',
      updated_at: '2026-01-01T00:00:00Z',
      blocks: [
        {
          id: 'b1',
          timestamp: '2026-01-01T00:00:00Z',
          message: {role: 'assistant', content: 'done', metadata: {step: 'single_run'}},
          artifacts: [
            {
              key: 'single_run_root_cause',
              reason: 'found',
              data: {headline: 'Divides by zero', cause: 'Empty weights.'},
            },
          ],
        },
      ],
    };

    it('shows no next step', () => {
      render(
        <SeerDrawerContent
          aiConfig={makeAiConfig()}
          autofix={makeAutofix({runState: singleRun})}
          group={GroupFixture()}
        />
      );

      expect(screen.getByText('Divides by zero')).toBeInTheDocument();
      expect(
        screen.queryByText('Are you happy with this root cause?')
      ).not.toBeInTheDocument();
    });

    it('opens the run in the Explorer chat from the bottom button', async () => {
      render(
        <SeerDrawerContent
          aiConfig={makeAiConfig()}
          autofix={makeAutofix({runState: singleRun})}
          group={GroupFixture()}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: 'Open Autofix'}));

      expect(mockOpenSeerExplorer).toHaveBeenCalledWith({runId: 776});
    });

    it('closes the chat when it is already open on this run', async () => {
      mockIsOpen = true;
      mockChatRunId = 776;
      render(
        <SeerDrawerContent
          aiConfig={makeAiConfig()}
          autofix={makeAutofix({runState: singleRun})}
          group={GroupFixture()}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: 'Open Autofix'}));

      expect(mockCloseSeerExplorer).toHaveBeenCalled();
      expect(mockOpenSeerExplorer).not.toHaveBeenCalled();
      mockIsOpen = false;
      mockChatRunId = null;
    });

    it('switches a chat open on another run to this run', async () => {
      mockIsOpen = true;
      mockChatRunId = 999;
      render(
        <SeerDrawerContent
          aiConfig={makeAiConfig()}
          autofix={makeAutofix({runState: singleRun})}
          group={GroupFixture()}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: 'Open Autofix'}));

      expect(mockChatDispatch).toHaveBeenCalledWith({type: 'set run id', payload: 776});
      mockIsOpen = false;
      mockChatRunId = null;
    });

    it('hides the root cause reset', () => {
      render(
        <SeerDrawerContent
          aiConfig={makeAiConfig()}
          autofix={makeAutofix({runState: singleRun})}
          group={GroupFixture()}
        />
      );

      expect(screen.queryByRole('button', {name: 'Re-run step'})).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Chat with Seer about this step'})
      ).not.toBeInTheDocument();
    });
  });
});
