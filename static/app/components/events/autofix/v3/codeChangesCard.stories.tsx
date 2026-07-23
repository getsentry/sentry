import type {ReactNode} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {
  AutofixSection,
  ExplorerAutofixState,
  RawFeedback,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {CodeChangesCard} from 'sentry/components/events/autofix/v3/codeChangesCard';
import * as Storybook from 'sentry/stories';
import type {User} from 'sentry/types/user';
import {OrganizationContext} from 'sentry/utils/organizationContext';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import type {ExplorerFilePatch} from 'sentry/views/seerExplorer/types';

// The Feedback section is gated behind this feature flag; the wrapper below
// injects it so every example renders it.
const PR_ITERATION_FEATURE = 'autofix-pr-iteration';

const noop = () => {};

/**
 * A minimal but realistic code-change artifact so the card renders its diff
 * body — the Feedback section is drawn directly above it.
 */
function makePatch(repoName: string, path: string): ExplorerFilePatch {
  return {
    repo_name: repoName,
    diff: '',
    patch: {
      path,
      added: 1,
      removed: 1,
      source_file: path,
      target_file: path,
      type: 'M',
      hunks: [
        {
          section_header: '',
          source_start: 10,
          source_length: 3,
          target_start: 10,
          target_length: 3,
          lines: [
            {
              line_type: ' ',
              value: 'def handler(request):',
              source_line_no: 10,
              target_line_no: 10,
              diff_line_no: null,
            },
            {
              line_type: '-',
              value: '    return user.name',
              source_line_no: 11,
              target_line_no: null,
              diff_line_no: null,
            },
            {
              line_type: '+',
              value: '    return user.name if user else None',
              source_line_no: null,
              target_line_no: 11,
              diff_line_no: null,
            },
          ],
        },
      ],
    },
  } as ExplorerFilePatch;
}

/**
 * A folded-in PR-iteration block. Its feedback drives one iteration and renders
 * as a `processed` item once the section is no longer processing.
 */
function makeFeedbackBlock(
  iterationIndex: number,
  feedback: RawFeedback
): AutofixSection['blocks'][number] {
  return {
    id: `block-pr-${iterationIndex}`,
    timestamp: '2026-07-20T00:00:00Z',
    message: {
      role: 'user',
      content: null,
      metadata: {
        step: 'pr_iteration',
        iteration_index: String(iterationIndex),
        feedback: JSON.stringify(feedback),
      },
    },
  };
}

function makeSection(
  status: AutofixSection['status'],
  blocks: AutofixSection['blocks']
): AutofixSection {
  return {
    step: 'code_changes',
    status,
    blocks,
    artifacts: [[makePatch('org/repo', 'src/handlers/user.py')]],
  };
}

function makeAutofix(
  queuedFeedback: RawFeedback[] = []
): ReturnType<typeof useExplorerAutofix> {
  const runState: ExplorerAutofixState = {
    run_id: 123,
    blocks: [],
    status: 'completed',
    updated_at: '2026-07-20T00:00:00Z',
    queued_feedback: queuedFeedback,
  };

  return {
    runState,
    isLoading: false,
    isPolling: false,
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

// Feedback source builders — one per member of the RawFeedback discriminated
// union, mirroring the wire shapes the backend serializes.
function userUiFeedback(text: string, user: User): RawFeedback {
  return {text, timestamp: '2026-07-20T00:00:00Z', source: {type: 'user-ui', user}};
}

function githubPrCommentFeedback(text: string): RawFeedback {
  return {
    text,
    timestamp: '2026-07-20T00:00:00Z',
    source: {
      type: 'github-pr-comment',
      comment: {
        html_url: 'https://github.com/org/repo/pull/42#issuecomment-1',
        user: {login: 'octocat'},
      },
    },
  };
}

function githubPrReviewCommentFeedback(text: string): RawFeedback {
  return {
    text,
    timestamp: '2026-07-20T00:00:00Z',
    source: {
      type: 'github-pr-review-comment',
      comment: {
        html_url: 'https://github.com/org/repo/pull/42#discussion_r1',
        user: {login: 'octocat'},
      },
    },
  };
}

function checkSuiteFeedback(): RawFeedback {
  return {
    // `text` is ignored for check-suite; the card derives its own label.
    text: 'raw check-suite payload',
    timestamp: '2026-07-20T00:00:00Z',
    source: {
      type: 'check-suite',
      app_name: 'CI',
      event: {
        check_suite: {id: 999, head_sha: 'abc1234'},
        repository: {html_url: 'https://github.com/org/repo'},
      },
    },
  };
}

// Feedback with no recognized source renders as the `other` fallback; the
// source is named in the avatar tooltip rather than prefixed on the comment.
function unknownFeedback(text: string): RawFeedback {
  return {text};
}

export default Storybook.story('CodeChangesCard Feedback', story => {
  story('All feedback sources', () => {
    const user = useUser();
    return (
      <FeatureWrapper>
        <Text size="sm" variant="muted">
          Every feedback source type, shown as <code>processed</code> block feedback (top
          six) plus <code>queued</code> feedback (bottom two). Newest is listed first.
          Note: multiline text is rendered inline (newlines collapse to spaces), so long
          comments wrap rather than preserving hard breaks.
        </Text>
        <CodeChangesCard
          groupId="1"
          autofix={makeAutofix([
            userUiFeedback('Also rename the variable for clarity', user),
            unknownFeedback('Feedback from an unrecognized source'),
          ])}
          section={makeSection('completed', [
            makeFeedbackBlock(0, userUiFeedback('Please add a null check', user)),
            makeFeedbackBlock(1, githubPrCommentFeedback('Can you add a test for this?')),
            makeFeedbackBlock(
              2,
              githubPrReviewCommentFeedback('This branch is never hit — remove it')
            ),
            makeFeedbackBlock(3, checkSuiteFeedback()),
            // Multiline GitHub PR comment — several lines of reviewer prose.
            makeFeedbackBlock(
              4,
              githubPrCommentFeedback(
                'A few things on this change:\n' +
                  '1. Guard against the null user before dereferencing.\n' +
                  '2. Add a regression test covering the empty-session path.\n' +
                  '3. The early return on line 42 looks unreachable — can we drop it?'
              )
            ),
            // Multiline "local" comment — feedback typed directly in the Seer UI
            // (the user-ui source), spanning multiple lines.
            makeFeedbackBlock(
              5,
              userUiFeedback(
                'Please also handle the case where the request has no authenticated user.\n\n' +
                  'When that happens today we throw a 500 instead of returning a clean 401, ' +
                  'so the whole flow should degrade gracefully rather than crash.',
                user
              )
            ),
          ])}
        />
      </FeatureWrapper>
    );
  });

  story('Feedback statuses', () => {
    const user = useUser();
    return (
      <Stack gap="xl">
        <StatusExample label="Processed — the iteration it drove has finished and its changes are pushed (accent checkmark).">
          <FeatureWrapper>
            <CodeChangesCard
              groupId="1"
              autofix={makeAutofix()}
              section={makeSection('completed', [
                makeFeedbackBlock(0, userUiFeedback('Please add a null check', user)),
              ])}
            />
          </FeatureWrapper>
        </StatusExample>

        <StatusExample label="In progress — driving the iteration currently being processed (spinner). The card body shows the “Iterating on PR…” loader.">
          <FeatureWrapper>
            <CodeChangesCard
              groupId="1"
              autofix={makeAutofix()}
              section={makeSection('processing', [
                makeFeedbackBlock(0, userUiFeedback('Fix the failing CI check', user)),
              ])}
            />
          </FeatureWrapper>
        </StatusExample>

        <StatusExample label="Queued — submitted while a run was processing, not yet picked up (muted circle + “Queued” label).">
          <FeatureWrapper>
            <CodeChangesCard
              groupId="1"
              autofix={makeAutofix([userUiFeedback('Make the button blue', user)])}
              section={makeSection('completed', [])}
            />
          </FeatureWrapper>
        </StatusExample>
      </Stack>
    );
  });
});

/**
 * Injects the `autofix-pr-iteration` feature into the surrounding organization
 * so the Feedback section renders. Mirrors the pattern used by
 * activityLineItem.stories.tsx.
 */
function FeatureWrapper({children}: {children: ReactNode}) {
  const organization = useOrganization();
  const features = [...organization.features, PR_ITERATION_FEATURE];

  return (
    <OrganizationContext.Provider value={{...organization, features}}>
      {children}
    </OrganizationContext.Provider>
  );
}

function StatusExample({children, label}: {children: ReactNode; label: string}) {
  return (
    <Stack gap="sm">
      <Text size="sm" variant="muted">
        {label}
      </Text>
      {children}
    </Stack>
  );
}
