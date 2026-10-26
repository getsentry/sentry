import type {ReactNode} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {
  AutofixSection,
  ExplorerAutofixState,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {SeerDrawerBody} from 'sentry/components/events/autofix/v3/body';
import {SeerDrawerHeader} from 'sentry/components/events/autofix/v3/header';
import {PullRequestsCard} from 'sentry/components/events/autofix/v3/pullRequestsCard';
import * as Storybook from 'sentry/stories';
import type {RepoPRState} from 'sentry/views/seerExplorer/types';

const noop = () => {};

const REPO = 'org/repo';

// The three shapes `repo_pr_states` takes across a PR's life. `creating` covers
// both the first push and a later iteration — `pr_number` is what tells them
// apart, and is what switches the button between "Creating" and "Updating".
function creatingPR(repoName = REPO): RepoPRState {
  return {
    repo_name: repoName,
    pr_creation_status: 'creating',
    pr_number: null,
    pr_url: null,
    pr_id: null,
    branch_name: null,
    commit_sha: null,
    pr_creation_error: null,
    title: null,
  };
}

function updatingPR(prNumber: number, repoName = REPO): RepoPRState {
  return {
    ...creatingPR(repoName),
    pr_number: prNumber,
    pr_url: `https://github.com/${repoName}/pull/${prNumber}`,
    pr_id: 900 + prNumber,
    branch_name: 'seer/fix-null-user',
    commit_sha: 'abc1234',
    title: 'Guard against a null user before dereferencing',
  };
}

function completedPR(prNumber: number, repoName = REPO): RepoPRState {
  return {
    ...updatingPR(prNumber, repoName),
    pr_creation_status: 'completed',
  };
}

function failedPR(repoName = REPO): RepoPRState {
  return {
    ...creatingPR(repoName),
    pr_creation_status: 'error',
    pr_creation_error: 'GitHub rejected the push: branch is protected.',
  };
}

function makeSection(pullRequests: RepoPRState[]): AutofixSection {
  return {
    step: 'pull_request',
    status: pullRequests.some(pr => pr.pr_creation_status === 'creating')
      ? 'processing'
      : 'completed',
    blocks: [],
    artifacts: [pullRequests],
  };
}

function makeAutofix(): ReturnType<typeof useExplorerAutofix> {
  const runState: ExplorerAutofixState = {
    run_id: 123,
    blocks: [],
    status: 'completed',
    updated_at: '2026-07-20T00:00:00Z',
    queued_feedback: [],
  };

  return {
    runState,
    autofixFormatted: null,
    isLoading: false,
    isWaitingForRun: false,
    isPolling: false,
    isProcessing: false,
    // Async no-ops — none of these are invoked by the static examples below.
    startStep: () => Promise.resolve(0),
    createPR: () => Promise.resolve(),
    reset: noop,
    triggerCodingAgentHandoff: () => Promise.resolve(),
    codingAgentErrors: [],
    dismissCodingAgentError: noop,
    warnings: [],
  };
}

export default Storybook.story('PullRequestsCard', story => {
  story('PR lifecycle', () => {
    return (
      <Stack gap="xl">
        <Text size="sm" variant="muted">
          The Pull Requests card as one PR moves through its life, each shown inside a
          mock Seer drawer so the buttons sit at the real drawer width. Every state's
          button should be sized to its own label and left-aligned — a button that
          stretches to the full drawer width is the bug this comparison exists to catch.
        </Text>

        <DrawerExample label="1. Creating — the first push is in flight. No PR number yet, so the button reads “Creating”.">
          <PullRequestsCard
            autofix={makeAutofix()}
            section={makeSection([creatingPR()])}
          />
        </DrawerExample>

        <DrawerExample label="2. Created — the PR is open. The link button carries the repo and number, with a copy-URL button beside it.">
          <PullRequestsCard
            autofix={makeAutofix()}
            section={makeSection([completedPR(4821)])}
          />
        </DrawerExample>

        <DrawerExample label="3. Updating — an iteration is pushing to the PR that already exists. Same `creating` status as step 1, but `pr_number` is set, so the wording changes and the copy-URL button stays available.">
          <PullRequestsCard
            autofix={makeAutofix()}
            section={makeSection([updatingPR(4821)])}
          />
        </DrawerExample>

        <DrawerExample label="4. Updated — the iteration landed and the card returns to the link button. Visually identical to step 2.">
          <PullRequestsCard
            autofix={makeAutofix()}
            section={makeSection([completedPR(4821)])}
          />
        </DrawerExample>
      </Stack>
    );
  });

  story('Every state at once', () => {
    return (
      <Stack gap="xl">
        <Text size="sm" variant="muted">
          One card holding a repo in each state. Stacked this way the widths are directly
          comparable: all four buttons should hug their own label and share a left edge.
        </Text>

        <DrawerExample label="Four repos, four states — creating, updating, completed, and a failed create that offers a retry.">
          <PullRequestsCard
            autofix={makeAutofix()}
            section={makeSection([
              creatingPR('org/api'),
              updatingPR(4821, 'org/frontend'),
              completedPR(1290, 'org/worker'),
              failedPR('org/infra'),
            ])}
          />
        </DrawerExample>
      </Stack>
    );
  });
});

/**
 * A non-interactive stand-in for the Seer drawer: the real header and body, in a
 * panel the card can stretch against. Without a surrounding drawer the card
 * would size to the story page instead, which is where full-width buttons hide.
 */
function FakeSeerDrawer({children}: {children: ReactNode}) {
  return (
    <Stack
      border="primary"
      radius="md"
      background="secondary"
      overflow="hidden"
      minWidth="0"
    >
      <SeerDrawerHeader />
      <SeerDrawerBody>{children}</SeerDrawerBody>
    </Stack>
  );
}

function DrawerExample({children, label}: {children: ReactNode; label: string}) {
  return (
    <Stack gap="sm">
      <Text size="sm" variant="muted">
        {label}
      </Text>
      <FakeSeerDrawer>{children}</FakeSeerDrawer>
    </Stack>
  );
}
