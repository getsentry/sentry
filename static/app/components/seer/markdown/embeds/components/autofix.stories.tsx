import {useMemo, useState, type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';

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
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {
  NEXT_STEP,
  STEP_LABELS,
} from 'sentry/components/seer/markdown/embeds/components/autofix';
import {IconArrow} from 'sentry/icons';
import * as Storybook from 'sentry/stories';
import type {Group} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SeerExplorerRunId} from 'sentry/views/seerExplorer/types';
import type {
  AutofixOverviewResponse,
  MilestoneKey,
  OverviewRun,
} from 'sentry/views/seerWorkflows/overview/types';

const ISSUE = {id: '6789012345', shortId: 'CHECKOUT-42'};

function autofix(step: AutofixExplorerStep, result: string): string {
  return `{% autofix %}${JSON.stringify({...ISSUE, step, result})}{% /autofix %}`;
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
  '`CartService.total()` calls `items.reduce((sum, item) => sum + item.price)` without an initial accumulator. When a customer empties their cart the array is empty, so `reduce` throws `TypeError: Reduce of empty array with no initial value` and the checkout request 500s.'
);

const SOLUTION = autofix(
  'solution',
  'Seed the reduction with `0` so an empty cart totals to zero instead of throwing: `items.reduce((sum, item) => sum + item.price, 0)`.'
);

const CODE_CHANGES = autofix(
  'code_changes',
  'Updated `src/checkout/cartService.ts` to pass the initial value and added a regression test covering the empty-cart path.'
);

// Autofix has no "plan" step — a plan is the write-up of the solution step.
const PLANNED_SOLUTION = autofix(
  'solution',
  'Guard `CartService.total()` with an initial accumulator of `0`, add a regression test covering the empty-cart path, then backfill a smoke test that renders the checkout page with zero items.'
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

function ChatShell({children}: {children: ReactNode}) {
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
        <Container borderTop="primary" background="primary" padding="lg xl">
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
        </Container>
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
});
