import {ExplorerAutofixStateFixture} from 'sentry-fixture/autofix';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {useAiConfig} from 'sentry/views/issueDetails/hooks/useAiConfig';

import {SeerDrawerContent} from './content';

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
    const startStep = jest.fn().mockResolvedValue(undefined);

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

  describe('out of Seer credits', () => {
    const organization = OrganizationFixture({features: ['seer-credit-checks']});
    const creditCheckUrl = `/organizations/${organization.slug}/seer/credit-check/`;

    it('swaps Start Analysis for the CTA', async () => {
      const creditCheck = MockApiClient.addMockResponse({
        url: creditCheckUrl,
        match: [MockApiClient.matchQuery({operation: 'autofix_root_cause'})],
        body: {hasEnoughCredits: false},
      });

      render(
        <SeerDrawerContent
          aiConfig={makeAiConfig()}
          autofix={makeAutofix()}
          group={GroupFixture()}
        />,
        {organization}
      );

      // The button never shows while the check is in flight.
      expect(
        screen.queryByRole('button', {name: 'Start Analysis'})
      ).not.toBeInTheDocument();
      expect(await screen.findByTestId('autofix-out-of-credits-cta')).toBeInTheDocument();
      expect(
        screen.getByText('Determine the root cause of your issue')
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Start Analysis'})
      ).not.toBeInTheDocument();
      expect(creditCheck).toHaveBeenCalledTimes(1);
    });

    it('keeps the root cause visible and swaps only the next step', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/coding-agents/`,
        body: {integrations: []},
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/project-slug/seer/repos/`,
        body: [{provider: 'github'}],
      });
      MockApiClient.addMockResponse({
        url: creditCheckUrl,
        match: [MockApiClient.matchQuery({operation: 'autofix_solution'})],
        body: {hasEnoughCredits: false},
      });

      render(
        <SeerDrawerContent
          aiConfig={makeAiConfig()}
          autofix={makeAutofix({runState: ExplorerAutofixStateFixture()})}
          group={GroupFixture()}
        />,
        {organization}
      );

      expect(await screen.findByTestId('autofix-out-of-credits-cta')).toBeInTheDocument();
      expect(
        screen.getByText('The issue was caused by an unexpected value.')
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Yes, make a plan'})
      ).not.toBeInTheDocument();
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

      expect(screen.getByRole('button', {name: 'Start Analysis'})).toBeInTheDocument();
      expect(creditCheck).not.toHaveBeenCalled();
    });
  });
});
