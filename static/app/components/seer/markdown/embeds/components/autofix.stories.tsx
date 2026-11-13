import {useMemo, useState, type ReactNode} from 'react';
import {IconArrow} from '@sentry/icons/arrow';
import {
  QueryClient,
  QueryClientProvider,
  skipToken,
  useQuery,
} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {AssistantMessage, MessageRow, UserMessage} from '@sentry/scraps/chat';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {getAutofixRunId} from 'sentry/components/events/autofix/autofixRunId';
import {
  getOrderedAutofixSections,
  isPullRequestsSection,
  useExplorerAutofix,
  type AutofixExplorerStep,
  type ExplorerAutofixState,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  AutofixChatProvider,
  useAutofixOutOfCreditsEmbeds,
} from 'sentry/components/seer/autofixChatContext';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {SeerOutOfCreditsCta} from 'sentry/components/seer/outOfCredits/seerOutOfCreditsCta';
import * as Storybook from 'sentry/stories';
import type {Group} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {OrganizationContext} from 'sentry/utils/organizationContext';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  Block,
  ExplorerFilePatch,
  SeerExplorerRunId,
} from 'sentry/views/seerExplorer/types';
import type {
  AutofixOverviewResponse,
  MilestoneKey,
  OverviewRun,
} from 'sentry/views/seerWorkflows/overview/types';

import {NEXT_STEP, STEP_LABELS} from './autofix';

const ISSUE = {id: '6789012345', shortId: 'CHECKOUT-42'};

/**
 * Taken from the embed schema so these fixtures fail to compile rather than
 * silently drop a field if the structured payload changes shape.
 */
type AutofixDetails = Pick<
  EmbedOutput<'autofix'>,
  'fiveWhys' | 'reproductionSteps' | 'steps'
>;

function autofix(
  step: AutofixExplorerStep,
  result: string,
  details: AutofixDetails = {}
): string {
  return `{% autofix %}${JSON.stringify({...ISSUE, step, result, ...details})}{% /autofix %}`;
}

function autofixRefTag(
  group: Pick<Group, 'id' | 'shortId'>,
  step: AutofixExplorerStep,
  runId: SeerExplorerRunId
): string {
  return `{% autofixRef %}${JSON.stringify({id: group.id, shortId: group.shortId, runId, step})}{% /autofixRef %}`;
}

const ROOT_CAUSE = autofix(
  'root_cause',
  '`CartService.total()` reduces the line items without an initial accumulator, so an empty cart throws `TypeError: Reduce of empty array with no initial value` and `POST /api/checkout/quote` 500s.',
  {
    fiveWhys: [
      '`POST /api/checkout/quote` returned a 500 for every request carrying an empty cart.',
      '`CartService.total()` threw `TypeError: Reduce of empty array with no initial value`.',
      '`items.reduce((sum, item) => sum + item.price)` is called without a second argument.',
      'Without an initial value `reduce` seeds itself from the first element, which an empty array does not have.',
      'The empty-cart path was never exercised — every fixture in `cartService.test.ts` seeds at least one line item.',
    ],
    reproductionSteps: [
      'Sign in as any customer and add one item to the cart.',
      'Remove that item, leaving the cart empty.',
      'Navigate to `/checkout`, which calls `POST /api/checkout/quote` on mount.',
      'The request 500s and the page falls back to the generic error state.',
    ],
  }
);

const SOLUTION = autofix(
  'solution',
  'Seed the reduction with `0` so an empty cart totals to zero instead of throwing.',
  {
    steps: [
      {
        title: 'Pass an initial accumulator to `CartService.total()`',
        description:
          'Change `items.reduce((sum, item) => sum + item.price)` to pass `0` as the second argument.',
      },
      {
        title: 'Cover the empty cart in `cartService.test.ts`',
        description: 'Assert `total()` returns `0` for an empty line-item array.',
      },
    ],
  }
);

const CODE_CHANGES = autofix(
  'code_changes',
  '2 files changed in 1 repo — `src/checkout/cartService.ts` now passes the initial value, and `src/checkout/cartService.test.ts` covers the empty-cart path.'
);

// Autofix has no "plan" step — a plan is the write-up of the solution step.
const PLANNED_SOLUTION = autofix(
  'solution',
  'Guard `CartService.total()` against an empty cart, then close the coverage gap that let this ship.',
  {
    steps: [
      {
        title: 'Pass an initial accumulator to `CartService.total()`',
        description:
          'Change `items.reduce((sum, item) => sum + item.price)` to pass `0` as the second argument.',
      },
      {
        title: 'Cover the empty cart in `cartService.test.ts`',
        description: 'Assert `total()` returns `0` for an empty line-item array.',
      },
      {
        title: 'Add a checkout smoke test with zero items',
        description:
          'Render `/checkout` with an empty cart in `static/app/views/checkout/components/ThisFilenameIsLongEnoughToOverflowTheAutofixContentPanel.spec.tsx` and assert the quote renders `$0.00` instead of the error state.',
      },
    ],
  }
);

function User({children}: {children: ReactNode}) {
  return (
    <MessageRow from="user">
      <UserMessage>{children}</UserMessage>
    </MessageRow>
  );
}

function Assistant({children}: {children: ReactNode}) {
  return (
    <MessageRow from="assistant">
      <AssistantMessage>{children}</AssistantMessage>
    </MessageRow>
  );
}

function Seer({raw}: {raw: string}) {
  return (
    <Assistant>
      <SeerMarkdown raw={raw} />
    </Assistant>
  );
}

function ChatShell({children, notice}: {children: ReactNode; notice?: ReactNode}) {
  return (
    <Storybook.SizingWindow display="block">
      <Stack
        width="100%"
        maxWidth="518px"
        height="640px"
        background="primary"
        border="primary"
        radius="md"
        overflow="hidden"
      >
        <Container flex="1" overflow="auto">
          {children}
        </Container>
        <Stack gap="lg" borderTop="primary" background="primary" padding="lg xl">
          {notice}
          <InputGroup>
            <InputGroup.TextArea
              rows={1}
              autosize
              maxRows={5}
              size="md"
              placeholder="Ask Seer a question, or press / for commands."
            />
            <InputGroup.TrailingItems>
              <Button
                size="xs"
                variant="transparent"
                icon={<IconArrow direction="right" />}
                aria-label="Send message"
              />
            </InputGroup.TrailingItems>
          </InputGroup>
        </Stack>
      </Stack>
    </Storybook.SizingWindow>
  );
}

interface AutofixOverviewIssue extends Pick<Group, 'id' | 'shortId'> {
  milestone: MilestoneKey;
  title: string;
}

const MILESTONE_LABELS: Record<MilestoneKey, string> = {
  autofix_root_cause: 'Root cause',
  autofix_solution: 'Plan',
  autofix_code_changes: 'Code changes',
  has_pull_request: 'Pull request',
  pull_requests_merged: 'Merged',
};

function flattenOverviewIssues(data: AutofixOverviewResponse): AutofixOverviewIssue[] {
  const seen = new Set<string>();
  const issues: AutofixOverviewIssue[] = [];
  for (const [milestone, runs] of Object.entries(data.runsByMilestone) as Array<
    [MilestoneKey, OverviewRun[]]
  >) {
    for (const run of runs) {
      if (seen.has(run.groupId)) {
        continue;
      }
      seen.add(run.groupId);
      issues.push({id: run.groupId, shortId: run.shortId, title: run.title, milestone});
    }
  }
  return issues;
}

/**
 * A stable pool of issues to pick from: ones Seer has already run Autofix on,
 * rather than a live `is:unresolved` search that churns as issues resolve.
 */
function useAutofixOverviewIssues() {
  const organization = useOrganization();
  return useQuery({
    ...apiOptions.as<AutofixOverviewResponse>()(
      '/organizations/$organizationIdOrSlug/seer/autofix-overview/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {project: [-1], statsPeriod: '90d', expand: ['status']},
        staleTime: 30_000,
      }
    ),
    select: data => flattenOverviewIssues(data.json),
  });
}

function IssuePicker({
  onChange,
  value,
}: {
  onChange: (issue: AutofixOverviewIssue) => void;
  value: AutofixOverviewIssue | null;
}) {
  const {data: issues, isPending} = useAutofixOverviewIssues();

  return (
    <CompactSelect
      search
      disabled={isPending}
      options={(issues ?? []).map(issue => ({
        value: issue.id,
        label: `${issue.shortId} — ${issue.title} (${MILESTONE_LABELS[issue.milestone]})`,
      }))}
      value={value?.id}
      onChange={opt => {
        const issue = issues?.find(candidate => candidate.id === opt.value);
        if (issue) {
          onChange(issue);
        }
      }}
    />
  );
}

const AUTOFIX_STEP_ORDER: AutofixExplorerStep[] = [
  'root_cause',
  'solution',
  'code_changes',
];

function isAutofixStep(step: string): step is AutofixExplorerStep {
  return step === 'pr_iteration' || (AUTOFIX_STEP_ORDER as string[]).includes(step);
}

/**
 * Renders every step already on the issue's real Autofix run state — reusing
 * `NEXT_STEP`/`STEP_LABELS` from the embed itself rather than tracking a
 * locally clicked-steps list, so what's shown always matches the backend.
 */
function AutofixIssueDemo({group}: {group: Pick<Group, 'id' | 'shortId'>}) {
  const explorerAutofix = useExplorerAutofix(group, {pollPR: true});
  const {runState, isLoading, isPolling, startStep, createPR} = explorerAutofix;
  const runId = getAutofixRunId(runState);

  const steps = useMemo(() => {
    const sections = getOrderedAutofixSections(runState);
    const explorerSteps = sections.map(section => section.step).filter(isAutofixStep);
    if (sections.some(isPullRequestsSection) && !explorerSteps.includes('pr_iteration')) {
      return [...explorerSteps, 'pr_iteration' as const];
    }
    return explorerSteps;
  }, [runState]);

  const lastStep = steps.at(-1);
  const nextStep = lastStep ? NEXT_STEP[lastStep] : AUTOFIX_STEP_ORDER[0];

  function handleTriggerNext() {
    if (nextStep) {
      startStep(nextStep, runId ? {runId} : undefined);
    }
  }

  function handleCreatePR() {
    if (runId) {
      createPR(runId);
    }
  }

  // Exactly one of these renders at a time, so a state we did not anticipate
  // (e.g. sections exist but no run id came back) is still visible instead of
  // silently rendering nothing.
  let body: ReactNode;
  if (isLoading) {
    body = <Text variant="muted">Loading Autofix state…</Text>;
  } else if (runId && steps.length > 0) {
    body = (
      <Storybook.SizingWindow display="block">
        {steps.map(step => (
          <MessageRow key={step} from="assistant">
            <AssistantMessage>
              <SeerMarkdown raw={autofixRefTag(group, step, runId)} />
            </AssistantMessage>
          </MessageRow>
        ))}
      </Storybook.SizingWindow>
    );
  } else if (isPolling) {
    body = <Text variant="muted">Starting the run…</Text>;
  } else if (steps.length > 0) {
    body = (
      <Text variant="danger">
        Autofix has {steps.length} step(s) recorded, but no run id came back — can't
        render step cards.
      </Text>
    );
  } else {
    body = <Text variant="muted">No Autofix run yet for this issue.</Text>;
  }

  return (
    <Stack gap="xl">
      <Flex gap="md" align="center" justify="between" wrap="wrap">
        <Text bold>{group.shortId}</Text>
        <Flex gap="sm">
          {lastStep === 'code_changes' && (
            <Button size="sm" disabled={isPolling} onClick={handleCreatePR}>
              Draft a pull request
            </Button>
          )}
          {nextStep && (
            <Button size="sm" disabled={isPolling} onClick={handleTriggerNext}>
              {steps.length
                ? `Continue: ${STEP_LABELS[nextStep]}`
                : `Run: ${STEP_LABELS[nextStep]}`}
            </Button>
          )}
        </Flex>
      </Flex>

      {body}
    </Stack>
  );
}

function AutofixRefStory() {
  const [issue, setIssue] = useState<AutofixOverviewIssue | null>(null);

  return (
    <Stack
      width="100%"
      minWidth="640px"
      background="primary"
      border="primary"
      radius="md"
      padding="xl"
      gap="xl"
    >
      <Stack gap="md">
        <Text bold>Pick an issue with existing Autofix activity</Text>
        <IssuePicker value={issue} onChange={setIssue} />
      </Stack>

      {issue && <Text>{issue.title}</Text>}

      <Container borderTop="primary" paddingTop="xl">
        {issue ? (
          <AutofixIssueDemo key={issue.id} group={issue} />
        ) : (
          <Text variant="muted">No issue selected yet.</Text>
        )}
      </Container>
    </Stack>
  );
}

const CREDITS_RUN_ID = 7;

function finishedStep(step: AutofixExplorerStep, rest: Partial<Block>): Block {
  return {
    id: step,
    timestamp: '2026-10-07T12:00:00Z',
    loading: false,
    message: {role: 'assistant', content: 'Step complete', metadata: {step}},
    ...rest,
  };
}

const ROOT_CAUSE_BLOCK = finishedStep('root_cause', {
  artifacts: [
    {
      key: 'root_cause',
      reason: 'Found the root cause',
      data: {
        one_line_description:
          '`CartService.total()` reduces the line items without an initial accumulator, so an empty cart throws and `POST /api/checkout/quote` 500s.',
        five_whys: [
          '`CartService.total()` threw `TypeError: Reduce of empty array with no initial value`.',
          '`items.reduce((sum, item) => sum + item.price)` is called without a second argument.',
        ],
      },
    },
  ],
});

const SOLUTION_BLOCK = finishedStep('solution', {
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
        ],
      },
    },
  ],
});

const CODE_CHANGES_BLOCK = finishedStep('code_changes', {
  merged_file_patches: [
    {
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
            source_start: 13,
            source_length: 1,
            target_start: 13,
            target_length: 1,
            lines: [
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
    } as ExplorerFilePatch,
  ],
});

function creditsRun(blocks: Block[]): ExplorerAutofixState {
  return {
    run_id: CREDITS_RUN_ID,
    blocks,
    status: 'completed',
    updated_at: '2026-10-07T12:00:00Z',
  };
}

/**
 * Answers the embeds' run request with the given run, the credit check with the
 * given balance, and every other request with an empty list.
 */
class CreditsQueryClient extends QueryClient {
  run: ExplorerAutofixState;
  hasEnoughCredits: boolean;

  constructor(run: ExplorerAutofixState, hasEnoughCredits: boolean) {
    super({defaultOptions: {queries: {retry: false}}});
    this.run = run;
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
    } else if (url.includes(`/issues/${ISSUE.id}/autofix/`)) {
      json = {autofix: this.run};
    }

    const queryFn = () => Promise.resolve({json, headers: {}});
    return {...defaulted, queryFn: queryFn as never};
  };
}

/**
 * A conversation in an org with credit checks on, out of credits unless
 * `hasEnoughCredits` is set, where the chat can still send, so each embed
 * offers its next step. Like the Explorer chat, it shows the out-of-credits
 * notice above the composer.
 */
function CreditsChat({
  children,
  description,
  run,
  hasEnoughCredits = false,
  isBillingMember = false,
}: {
  children: ReactNode;
  description: ReactNode;
  run: ExplorerAutofixState;
  hasEnoughCredits?: boolean;
  /**
   * Billing members configure auto-reload; everyone else contacts their admins.
   */
  isBillingMember?: boolean;
}) {
  const organization = useOrganization();
  const [queryClient] = useState(() => new CreditsQueryClient(run, hasEnoughCredits));
  const {isAutofixOutOfCredits, autofixDenialReason, reportOutOfCredits} =
    useAutofixOutOfCreditsEmbeds();

  return (
    <Stack gap="md">
      <Text size="sm" variant="muted">
        {description}
      </Text>
      <OrganizationContext.Provider
        value={{
          ...organization,
          access: isBillingMember
            ? [...organization.access, 'org:billing']
            : organization.access.filter(scope => scope !== 'org:billing'),
          features: [
            ...organization.features,
            'seer-credit-checks',
            'token-billed-seer-enabled',
          ],
        }}
      >
        <QueryClientProvider client={queryClient}>
          <AutofixChatProvider
            sendMessage={() => {}}
            reportOutOfCredits={reportOutOfCredits}
          >
            <ChatShell
              notice={
                isAutofixOutOfCredits ? (
                  <SeerOutOfCreditsCta
                    reason="autofix-continue"
                    denialReason={autofixDenialReason}
                    size="md"
                  />
                ) : null
              }
            >
              {children}
            </ChatShell>
          </AutofixChatProvider>
        </QueryClientProvider>
      </OrganizationContext.Provider>
    </Stack>
  );
}

export default Storybook.story('Autofix', story => {
  story('Fix it end to end', () => (
    <ChatShell>
      <User>
        The checkout page is throwing errors for a bunch of users. Can you fix{' '}
        {ISSUE.shortId} all the way?
      </User>
      <Seer
        raw={`On it — running Autofix now. First, the root cause:\n\n${ROOT_CAUSE}`}
      />
      <Seer raw={`Here's the fix I'd apply:\n\n${SOLUTION}`} />
      <Seer
        raw={`And the changes are ready:\n\n${CODE_CHANGES}\n\nWant me to open a pull request?`}
      />
    </ChatShell>
  ));

  story('Ask for current status', () => (
    <ChatShell>
      <User>What's the status of Autofix on {ISSUE.shortId}?</User>
      <Seer
        raw={`Autofix has reached the last step. Here's where it landed:\n\n${CODE_CHANGES}`}
      />
    </ChatShell>
  ));

  story('Ask for the root cause mid-chat', () => (
    <ChatShell>
      <User>Hey, are error rates up today?</User>
      <Seer raw="Yes — checkout errors spiked about 40 minutes ago, concentrated on the `/checkout` endpoint." />
      <User>Ugh. Which issue is it?</User>
      <Seer raw={`It's ${ISSUE.shortId}, and it accounts for most of the new volume.`} />
      <User>Show me the root cause of {ISSUE.shortId}.</User>
      <Seer raw={ROOT_CAUSE} />
    </ChatShell>
  ));

  story('From root cause to a plan', () => (
    <ChatShell>
      <Seer
        raw={`I dug into ${ISSUE.shortId} and here's the root cause:\n\n${ROOT_CAUSE}`}
      />
      <User>So it only breaks when the cart is completely empty?</User>
      <Seer raw="Exactly — any cart with at least one item supplies the accumulator implicitly, so the crash is scoped to the empty-cart path." />
      <User>Got it. Put together a plan to fix it.</User>
      <Seer raw={`Here's the plan:\n\n${PLANNED_SOLUTION}`} />
    </ChatShell>
  ));

  story('Live Autofix run (autofixRef)', () => <AutofixRefStory />);

  story('Out of credits: after the root cause', () => (
    <CreditsChat
      description="Open the card, seen by a member. The root cause stays readable and Continue: Plan is disabled (autofix_solution). The autofix-continue notice sits above the composer, where it stays in view as the chat scrolls."
      run={creditsRun([ROOT_CAUSE_BLOCK])}
    >
      <User>Why is {ISSUE.shortId} happening?</User>
      <Seer
        raw={`Here's the root cause:\n\n${autofixRefTag(ISSUE, 'root_cause', CREDITS_RUN_ID)}`}
      />
    </CreditsChat>
  ));

  story('Out of credits: after the root cause, billing member', () => (
    <CreditsChat
      description="The same chat for a billing member, who configures auto-reload instead of contacting an admin."
      run={creditsRun([ROOT_CAUSE_BLOCK])}
      isBillingMember
    >
      <User>Why is {ISSUE.shortId} happening?</User>
      <Seer
        raw={`Here's the root cause:\n\n${autofixRefTag(ISSUE, 'root_cause', CREDITS_RUN_ID)}`}
      />
    </CreditsChat>
  ));

  story('Out of credits: after the plan', () => (
    <CreditsChat
      description="Open the card. The plan stays readable and Continue: Code Changes is disabled (autofix_code_changes); the notice sits above the composer."
      run={creditsRun([ROOT_CAUSE_BLOCK, SOLUTION_BLOCK])}
    >
      <User>Plan a fix for {ISSUE.shortId}.</User>
      <Seer
        raw={`Here's the plan:\n\n${autofixRefTag(ISSUE, 'solution', CREDITS_RUN_ID)}`}
      />
    </CreditsChat>
  ));

  story('Out of credits: Create PR', () => (
    <CreditsChat
      description="Open the Code Changes card. The diff stays readable and Draft a pull request is disabled (autofix_open_pr); the notice sits above the composer."
      run={creditsRun([ROOT_CAUSE_BLOCK, SOLUTION_BLOCK, CODE_CHANGES_BLOCK])}
    >
      <User>Write the fix for {ISSUE.shortId}.</User>
      <Seer
        raw={`And the changes:\n\n${autofixRefTag(ISSUE, 'code_changes', CREDITS_RUN_ID)}`}
      />
    </CreditsChat>
  ));

  story('With credits: after the root cause', () => (
    <CreditsChat
      description="For comparison: open the card. No notice, and Continue: Plan is enabled."
      run={creditsRun([ROOT_CAUSE_BLOCK])}
      hasEnoughCredits
    >
      <User>Why is {ISSUE.shortId} happening?</User>
      <Seer
        raw={`Here's the root cause:\n\n${autofixRefTag(ISSUE, 'root_cause', CREDITS_RUN_ID)}`}
      />
    </CreditsChat>
  ));
});
