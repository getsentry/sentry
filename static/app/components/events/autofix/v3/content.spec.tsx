import {
  AutofixRepoPRStateFixture,
  ExplorerAutofixStateFixture,
} from 'sentry-fixture/autofix';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {
  ExplorerAutofixState,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {SeerOutOfCreditsCtaProps} from 'sentry/components/seer/outOfCredits/seerOutOfCreditsCta';
import {registerOverride} from 'sentry/overrideRegistry';
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

    it('disables Open Autofix while the chat is open on this run', () => {
      mockIsOpen = true;
      mockChatRunId = 776;
      render(
        <SeerDrawerContent
          aiConfig={makeAiConfig()}
          autofix={makeAutofix({runState: singleRun})}
          group={GroupFixture()}
        />
      );

      expect(screen.getByRole('button', {name: 'Open Autofix'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
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

  describe('out of Seer credits', () => {
    const organization = OrganizationFixture({
      features: ['seer-credit-checks', 'token-billed-seer-enabled'],
    });
    const creditCheckUrl = `/organizations/${organization.slug}/seer/credit-check/`;

    // getsentry fills in the CTA; this stand-in shows what it was asked for.
    function StubOutOfCreditsCta({
      reason,
      variant = 'warning',
    }: SeerOutOfCreditsCtaProps) {
      return <div data-test-id="seer-out-of-credits-cta">{`${variant} ${reason}`}</div>;
    }

    function mockCreditCheck(operation: string, hasEnoughCredits = false) {
      return MockApiClient.addMockResponse({
        url: creditCheckUrl,
        match: [MockApiClient.matchQuery({operation})],
        body: {hasEnoughCredits},
      });
    }

    function expectAbove(first: HTMLElement, second: HTMLElement) {
      expect(
        first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }

    beforeEach(() => {
      registerOverride('component:seer-out-of-credits-cta', () => StubOutOfCreditsCta);
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/coding-agents/`,
        body: {integrations: []},
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/project-slug/seer/repos/`,
        body: [{provider: 'github'}],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/1/autofix/repos/`,
        body: {repos: [{has_write_access: true}]},
      });
    });

    it('shows the start alert above a disabled Start Analysis', async () => {
      const creditCheck = mockCreditCheck('autofix_root_cause');

      render(
        <SeerDrawerContent
          aiConfig={makeAiConfig()}
          autofix={makeAutofix()}
          group={GroupFixture()}
        />,
        {organization}
      );

      // Held disabled while the check is in flight.
      expect(screen.getByRole('button', {name: 'Start Analysis'})).toBeDisabled();

      const cta = await screen.findByTestId('seer-out-of-credits-cta');
      expect(cta).toHaveTextContent('warning autofix-start');
      expect(screen.getAllByTestId('seer-out-of-credits-cta')).toHaveLength(1);
      expect(
        screen.getByText('Determine the root cause of your issue')
      ).toBeInTheDocument();
      const startButton = screen.getByRole('button', {name: 'Start Analysis'});
      expect(startButton).toBeDisabled();
      expectAbove(cta, startButton);
      // The alert and the start card share one check.
      expect(creditCheck).toHaveBeenCalledTimes(1);
    });

    it('shows the continue alert above the root cause and disables the next step', async () => {
      mockCreditCheck('autofix_solution');

      render(
        <SeerDrawerContent
          aiConfig={makeAiConfig()}
          autofix={makeAutofix({runState: ExplorerAutofixStateFixture()})}
          group={GroupFixture()}
        />,
        {organization}
      );

      const cta = await screen.findByTestId('seer-out-of-credits-cta');
      expect(cta).toHaveTextContent('warning autofix-continue');
      expect(screen.getAllByTestId('seer-out-of-credits-cta')).toHaveLength(1);
      expectAbove(cta, screen.getByText('The issue was caused by an unexpected value.'));
      expect(screen.getByRole('button', {name: 'Yes, make a plan'})).toBeDisabled();
      expect(screen.getByRole('button', {name: 'No'})).toBeDisabled();
    });

    it('shows the continue alert for a step that stopped, without touching its retry', async () => {
      const creditCheck = mockCreditCheck('autofix_root_cause');

      render(
        <SeerDrawerContent
          aiConfig={makeAiConfig()}
          autofix={makeAutofix({
            runState: ExplorerAutofixStateFixture({status: 'error'}),
          })}
          group={GroupFixture()}
        />,
        {organization}
      );

      expect(await screen.findByTestId('seer-out-of-credits-cta')).toHaveTextContent(
        'warning autofix-continue'
      );
      expect(creditCheck).toHaveBeenCalledTimes(1);
    });

    it('shows the continue alert for a failed PR, leaving Retry PR to its card', async () => {
      mockCreditCheck('autofix_open_pr');

      render(
        <SeerDrawerContent
          aiConfig={makeAiConfig()}
          autofix={makeAutofix({
            runState: ExplorerAutofixStateFixture({
              repo_pr_states: {
                'org/repository': AutofixRepoPRStateFixture({
                  pr_creation_status: 'error',
                  pr_creation_error: 'Something went wrong',
                  pr_number: null,
                  pr_url: null,
                }),
              },
            }),
          })}
          group={GroupFixture()}
        />,
        {organization}
      );

      expect(await screen.findByTestId('seer-out-of-credits-cta')).toHaveTextContent(
        'warning autofix-continue'
      );
      expect(
        screen.getByRole('button', {name: 'Retry PR in org/repository'})
      ).toBeEnabled();
    });

    it('does not check credits while a step is running', () => {
      const creditCheck = MockApiClient.addMockResponse({
        url: creditCheckUrl,
        body: {hasEnoughCredits: false},
      });

      render(
        <SeerDrawerContent
          aiConfig={makeAiConfig()}
          autofix={makeAutofix({
            runState: ExplorerAutofixStateFixture({status: 'processing'}),
            isPolling: true,
          })}
          group={GroupFixture()}
        />,
        {organization}
      );

      expect(
        screen.getByText('The issue was caused by an unexpected value.')
      ).toBeInTheDocument();
      expect(screen.queryByTestId('seer-out-of-credits-cta')).not.toBeInTheDocument();
      expect(creditCheck).not.toHaveBeenCalled();
    });

    it('shows no alert when the org can afford the next step', async () => {
      mockCreditCheck('autofix_solution', true);

      render(
        <SeerDrawerContent
          aiConfig={makeAiConfig()}
          autofix={makeAutofix({runState: ExplorerAutofixStateFixture()})}
          group={GroupFixture()}
        />,
        {organization}
      );

      await waitFor(() =>
        expect(screen.getByRole('button', {name: 'Yes, make a plan'})).toBeEnabled()
      );
      expect(screen.queryByTestId('seer-out-of-credits-cta')).not.toBeInTheDocument();
    });

    it('starts as before without seer-credit-checks', () => {
      const creditCheck = MockApiClient.addMockResponse({
        url: creditCheckUrl,
        body: {hasEnoughCredits: false},
      });

      render(
        <SeerDrawerContent
          aiConfig={makeAiConfig()}
          autofix={makeAutofix()}
          group={GroupFixture()}
        />
      );

      expect(screen.getByRole('button', {name: 'Start Analysis'})).toBeEnabled();
      expect(creditCheck).not.toHaveBeenCalled();
    });
  });
});
