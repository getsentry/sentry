import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {
  AutofixSection,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {SeerCreditCheckStub} from 'sentry/components/seer/outOfCredits/__stories__/seerCreditCheckStub';
import * as Storybook from 'sentry/stories';

import {SolutionCard} from './solutionCard';

const noop = () => {};

const OUT_OF_CREDITS_AUTOFIX: ReturnType<typeof useExplorerAutofix> = {
  runState: {
    run_id: 123,
    blocks: [],
    status: 'error',
    failure_reason: 'out_of_credits',
    updated_at: '2026-07-20T00:00:00Z',
  },
  autofixFormatted: null,
  isLoading: false,
  isWaitingForRun: false,
  isPolling: false,
  isProcessing: false,
  // None of these are invoked by the static examples below.
  startStep: () => Promise.resolve({runId: 0, isSingleRun: false}),
  createPR: () => Promise.resolve(),
  reset: noop,
  triggerCodingAgentHandoff: () => Promise.resolve(),
  codingAgentErrors: [],
  dismissCodingAgentError: noop,
  warnings: [],
};

// The block Seer appends when a run stops for credits. The card leaves it out
// and says why the step stopped instead.
const SEER_OUT_OF_CREDITS_BLOCK: AutofixSection['blocks'][number] = {
  id: 'error-1',
  timestamp: '2026-07-20T00:00:00Z',
  message: {
    role: 'assistant',
    content:
      "Your organization doesn't have enough Seer credits for this, so I stopped here. Add credits to continue.",
  },
};

const PARTIAL_BLOCK: AutofixSection['blocks'][number] = {
  id: 'block-solution',
  timestamp: '2026-07-20T00:00:00Z',
  message: {
    role: 'assistant',
    content:
      'Pass `0` as the initial value to `reduce` in `CartService.total()` so an empty cart totals to zero. Next I was going to plan a regression test for the empty cart.',
    metadata: {step: 'solution'},
  },
};

function makeOutOfCreditsSection(blocks: AutofixSection['blocks']): AutofixSection {
  return {
    step: 'solution',
    status: 'error',
    failureReason: 'out_of_credits',
    blocks: [...blocks, SEER_OUT_OF_CREDITS_BLOCK],
    artifacts: [],
  };
}

function StoppedForCredits({
  blocks = [PARTIAL_BLOCK],
}: {
  blocks?: AutofixSection['blocks'];
}) {
  return (
    <SolutionCard
      autofix={OUT_OF_CREDITS_AUTOFIX}
      section={makeOutOfCreditsSection(blocks)}
    />
  );
}

export default Storybook.story('SolutionCard', story => {
  story('Stopped for credits', () => (
    <Stack gap="xl">
      <Text size="sm" variant="muted">
        The organization ran out of Seer credits while Seer was writing the plan. The run
        ends with <code>failure_reason: out_of_credits</code>. The card keeps what Seer
        wrote so far, then says why the step stopped. The credit check for{' '}
        <code>autofix_solution</code> says the organization still can't afford it, so
        Re-run and the header's Re-run step are disabled (hover Re-run for why). The
        out-of-credits CTA is not here: the alert at the top of the Autofix tab and drawer
        covers it.
      </Text>
      <SeerCreditCheckStub hasEnoughCredits={false}>
        <StoppedForCredits />
      </SeerCreditCheckStub>
    </Stack>
  ));

  story('Stopped for credits, after a top-up', () => (
    <Stack gap="xl">
      <Text size="sm" variant="muted">
        The same stopped run once the organization has added credits: the credit check now
        says it can afford <code>autofix_solution</code>, so Re-run and Re-run step are
        enabled again without reloading.
      </Text>
      <SeerCreditCheckStub hasEnoughCredits>
        <StoppedForCredits />
      </SeerCreditCheckStub>
    </Stack>
  ));

  story('Stopped before writing anything', () => (
    <Stack gap="xl">
      <Text size="sm" variant="muted">
        When the run stops before Seer writes anything, the card only says why it stopped.
      </Text>
      <SeerCreditCheckStub hasEnoughCredits={false}>
        <StoppedForCredits blocks={[]} />
      </SeerCreditCheckStub>
    </Stack>
  ));
});
