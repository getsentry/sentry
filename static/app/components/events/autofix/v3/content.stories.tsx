import {useState, type ReactNode} from 'react';
import {QueryClient, QueryClientProvider, skipToken} from '@tanstack/react-query';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {
  ExplorerAutofixState,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import * as Storybook from 'sentry/stories';
import type {Group} from 'sentry/types/group';
import {OrganizationContext} from 'sentry/utils/organizationContext';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {useAiConfig} from 'sentry/views/issueDetails/hooks/useAiConfig';
import type {
  Block,
  ExplorerFilePatch,
  RepoPRState,
} from 'sentry/views/seerExplorer/types';

import {SeerDrawerBody} from './body';
import {SeerDrawerContent} from './content';
import {SeerDrawerHeader} from './header';

const noop = () => {};

const GROUP = {
  id: '1',
  shortId: 'CHECKOUT-42',
  project: {id: '1', slug: 'checkout'},
} as unknown as Group;

const AI_CONFIG: ReturnType<typeof useAiConfig> = {
  areAiFeaturesAllowed: true,
  hasAutofix: true,
  hasAutofixQuota: true,
  hasGithubIntegration: true,
  hasResources: false,
  hasSummary: true,
  isAutofixSetupLoading: false,
  orgNeedsGenAiAcknowledgement: false,
  refetchAutofixSetup: noop,
  seerReposLinked: true,
};

const TIMESTAMP = '2026-10-07T12:00:00Z';

function stepBlock(step: string, rest: Partial<Block>): Block {
  return {
    id: step,
    timestamp: TIMESTAMP,
    loading: false,
    message: {role: 'assistant', content: 'Step complete', metadata: {step}},
    ...rest,
  };
}

const ROOT_CAUSE = stepBlock('root_cause', {
  artifacts: [
    {
      key: 'root_cause',
      reason: 'Found the root cause',
      data: {
        one_line_description:
          '`CartService.total()` reduces the line items without an initial accumulator, so an empty cart throws and `POST /api/checkout/quote` 500s.',
        five_whys: [
          '`POST /api/checkout/quote` returned a 500 for every request carrying an empty cart.',
          '`CartService.total()` threw `TypeError: Reduce of empty array with no initial value`.',
          '`items.reduce((sum, item) => sum + item.price)` is called without a second argument.',
        ],
        reproduction_steps: [
          'Add one item to the cart, then remove it.',
          'Open `/checkout`, which requests a quote on mount.',
        ],
      },
    },
  ],
});

const SOLUTION = stepBlock('solution', {
  artifacts: [
    {
      key: 'solution',
      reason: 'Made a plan',
      data: {
        one_line_summary:
          'Seed the reduction with `0` so an empty cart totals to zero instead of throwing.',
        steps: [
          {
            title: 'Pass an initial accumulator to `CartService.total()`',
            description: 'Pass `0` as the second argument to `items.reduce`.',
          },
          {
            title: 'Cover the empty cart in `cartService.test.ts`',
            description: 'Assert `total()` returns `0` for an empty cart.',
          },
        ],
      },
    },
  ],
});

const PATCH = {
  repo_name: 'acme/checkout',
  diff: '',
  patch: {
    path: 'src/checkout/cartService.ts',
    added: 1,
    removed: 1,
    source_file: 'src/checkout/cartService.ts',
    target_file: 'src/checkout/cartService.ts',
    type: 'M',
    hunks: [
      {
        section_header: 'total(items: LineItem[]) {',
        source_start: 12,
        source_length: 3,
        target_start: 12,
        target_length: 3,
        lines: [
          {
            line_type: ' ',
            value: '  total(items: LineItem[]) {',
            source_line_no: 12,
            target_line_no: 12,
            diff_line_no: null,
          },
          {
            line_type: '-',
            value: '    return items.reduce((sum, item) => sum + item.price);',
            source_line_no: 13,
            target_line_no: null,
            diff_line_no: null,
          },
          {
            line_type: '+',
            value: '    return items.reduce((sum, item) => sum + item.price, 0);',
            source_line_no: null,
            target_line_no: 13,
            diff_line_no: null,
          },
        ],
      },
    ],
  },
} as ExplorerFilePatch;

const CODE_CHANGES = stepBlock('code_changes', {merged_file_patches: [PATCH]});

const PULL_REQUEST: RepoPRState = {
  repo_name: 'acme/checkout',
  branch_name: 'seer/empty-cart-total',
  commit_sha: 'a1b2c3d',
  pr_creation_error: null,
  pr_creation_status: 'completed',
  pr_id: 4821,
  pr_number: 4821,
  pr_url: 'https://github.com/acme/checkout/pull/4821',
  title: 'fix(checkout): Total an empty cart to zero',
};

function makeAutofix(
  runState: ExplorerAutofixState | null
): ReturnType<typeof useExplorerAutofix> {
  return {
    runState,
    autofixFormatted: null,
    isLoading: false,
    isWaitingForRun: false,
    isPolling: false,
    isProcessing: false,
    // Async no-ops: the stories only show which triggers are on offer.
    startStep: () => Promise.resolve({runId: 0, isSingleRun: false}),
    createPR: () => Promise.resolve(),
    reset: noop,
    triggerCodingAgentHandoff: () => Promise.resolve(),
    codingAgentErrors: [],
    dismissCodingAgentError: noop,
    warnings: [],
  };
}

function makeRun(
  blocks: Block[],
  overrides: Partial<ExplorerAutofixState> = {}
): ExplorerAutofixState {
  return {
    run_id: 123,
    blocks,
    status: 'completed',
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

/**
 * Answers the credit check with the given balance, and the other requests the
 * drawer makes with empty results, so each story is the same on every load.
 */
class SimulatedCreditsQueryClient extends QueryClient {
  hasEnoughCredits: boolean;

  constructor(hasEnoughCredits: boolean) {
    super({defaultOptions: {queries: {retry: false}}});
    this.hasEnoughCredits = hasEnoughCredits;
  }

  override defaultQueryOptions: QueryClient['defaultQueryOptions'] = options => {
    const defaulted = super.defaultQueryOptions(options);
    if (defaulted.queryFn === skipToken) {
      return defaulted;
    }

    const url = String(defaulted.queryKey[0]);
    let json: unknown = [];
    if (url.includes('/seer/credit-check/')) {
      json = {hasEnoughCredits: this.hasEnoughCredits};
    } else if (url.includes('/autofix/repos/')) {
      json = {repos: []};
    } else if (url.includes('/coding-agents/')) {
      json = {integrations: []};
    }

    const queryFn = () => Promise.resolve({json, headers: {}});
    return {...defaulted, queryFn: queryFn as never};
  };
}

interface DrawerStoryProps {
  description: ReactNode;
  runState: ExplorerAutofixState | null;
  hasEnoughCredits?: boolean;
}

/**
 * The real drawer content for an org with credit checks on, in a stand-in for
 * the Seer drawer so the CTA sits at the drawer's width.
 */
function DrawerStory({
  description,
  runState,
  hasEnoughCredits = false,
}: DrawerStoryProps) {
  const organization = useOrganization();
  const [queryClient] = useState(() => new SimulatedCreditsQueryClient(hasEnoughCredits));

  return (
    <Stack gap="md">
      <Text size="sm" variant="muted">
        {description}
      </Text>
      <OrganizationContext.Provider
        value={{
          ...organization,
          features: [
            ...organization.features,
            'seer-credit-checks',
            'token-billed-seer-enabled',
          ],
        }}
      >
        <QueryClientProvider client={queryClient}>
          <Stack
            border="primary"
            radius="md"
            background="secondary"
            overflow="hidden"
            minWidth="0"
            maxWidth="640px"
          >
            <SeerDrawerHeader />
            <SeerDrawerBody>
              <SeerDrawerContent
                aiConfig={AI_CONFIG}
                autofix={makeAutofix(runState)}
                group={GROUP}
              />
            </SeerDrawerBody>
          </Stack>
        </QueryClientProvider>
      </OrganizationContext.Provider>
    </Stack>
  );
}

export default Storybook.story('SeerDrawerContent', story => {
  story('Out of credits: before a run', () => (
    <DrawerStory
      description="No run yet. The autofix-start alert sits at the top; the start card stays below it with Start Analysis disabled (autofix_root_cause)."
      runState={null}
    />
  ));

  story('Out of credits: after the root cause', () => (
    <DrawerStory
      description="The autofix-continue alert sits above the root cause. “Are you happy with this root cause?” stays at the bottom with No and Yes, make a plan disabled (autofix_solution). The coding agent menu stays available."
      runState={makeRun([ROOT_CAUSE])}
    />
  ));

  story('Out of credits: after the plan', () => (
    <DrawerStory
      description="The alert sits above the root cause and plan. No and Yes, write a code fix are disabled (autofix_code_changes)."
      runState={makeRun([ROOT_CAUSE, SOLUTION])}
    />
  ));

  story('Out of credits: Create PR', () => (
    <DrawerStory
      description="The alert sits above every result so far, code changes included. No and Yes, draft a PR are disabled (autofix_open_pr)."
      runState={makeRun([ROOT_CAUSE, SOLUTION, CODE_CHANGES])}
    />
  ));

  story('Out of credits: PR iteration', () => (
    <DrawerStory
      description="The PR is open. The alert sits at the top, and the feedback form that would iterate on the PR is disabled (autofix_pr_iteration)."
      runState={makeRun([ROOT_CAUSE, SOLUTION, CODE_CHANGES], {
        repo_pr_states: {[PULL_REQUEST.repo_name]: PULL_REQUEST},
      })}
    />
  ));

  story('Out of credits: a step that stopped', () => (
    <DrawerStory
      description="The plan step failed after the root cause. The autofix-continue alert covers the retry (autofix_solution); the card's own retry is left to the failure handling."
      runState={makeRun([ROOT_CAUSE, SOLUTION], {status: 'error'})}
    />
  ));

  story('With credits: before a run', () => (
    <DrawerStory
      description="For comparison: no alert, and Start Analysis is enabled."
      runState={null}
      hasEnoughCredits
    />
  ));

  story('With credits: after the root cause', () => (
    <DrawerStory
      description="For comparison: the same run when the org can afford the next step."
      runState={makeRun([ROOT_CAUSE])}
      hasEnoughCredits
    />
  ));
});
