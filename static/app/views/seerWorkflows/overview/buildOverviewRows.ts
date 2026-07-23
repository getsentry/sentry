import {
  type ExplorerAutofixState,
  getAutofixArtifactFromSection,
  getOrderedAutofixSections,
  isCodeChangesArtifact,
  isCodeChangesSection,
} from 'sentry/components/events/autofix/useExplorerAutofix';

import {RUN_QUESTIONS} from './runQuestions';
import {mapRunSourceToTrigger} from './triggerBadge';
import {
  type AutofixStateKey,
  type OverviewIssue,
  type OverviewRow,
  type PatchStats,
  PIPELINE,
  type RunAnalysisEntry,
  type RunQuestion,
  type SeerRun,
} from './types';

// The pipeline steps the run has reached, from getOrderedAutofixSections'
// section steps (which fold repo_pr_states into a synthetic pull_request
// section and coding_agents into their own).
function reachedSteps(state: ExplorerAutofixState | null): Set<string> {
  return new Set(getOrderedAutofixSections(state).map(section => section.step));
}

/**
 * The focus-mode fallback for a card with no server section: walk the pipeline
 * furthest-first (by fill) and return the furthest stage the run reached. The
 * issues endpoint doesn't return issue.autofix_state for a single pinned id, so
 * this reconstructs it from the enrichment the same way the section query would
 * have bucketed it. One precedence encoding, shared with the section list.
 */
export function deriveSectionKey(
  run: SeerRun | null,
  state: ExplorerAutofixState | null
): AutofixStateKey {
  const steps = reachedSteps(state);
  const reached: Record<AutofixStateKey, boolean> = {
    merged: (run?.pullRequests ?? []).some(pr => pr.status === 'merged'),
    review_pr: steps.has('pull_request'),
    code_changes_ready: steps.has('code_changes') || steps.has('coding_agents'),
    solution_ready: steps.has('solution'),
    needs_investigation: true,
  };
  return [...PIPELINE].sort((a, b) => b.fill - a.fill).find(stage => reached[stage.key])!
    .key;
}

// A diff qualifies for the on-card differ only when it is genuinely small:
// few files, few changed lines, and bounded hunk context so a fix with huge
// surrounding context can't blow the card up.
export const INLINE_DIFF_MAX_FILES = 2;
export const INLINE_DIFF_MAX_CHANGED_LINES = 25;
const INLINE_DIFF_MAX_RENDERED_LINES = 60;

export function extractPatchInfo(state: ExplorerAutofixState | null): {
  inlinePatches?: OverviewRow['inlinePatches'];
  patchStats?: PatchStats;
} {
  const section = getOrderedAutofixSections(state).find(isCodeChangesSection);
  if (!section) {
    return {};
  }
  const artifact = getAutofixArtifactFromSection(section);
  if (!isCodeChangesArtifact(artifact)) {
    return {};
  }
  // Disambiguate paths with the repo name only when the diff spans repos.
  const multiRepo = new Set(artifact.map(filePatch => filePatch.repo_name)).size > 1;
  const fileList = artifact
    .map(filePatch => ({
      path: multiRepo
        ? `${filePatch.repo_name}:${filePatch.patch.path}`
        : filePatch.patch.path,
      added: filePatch.patch.added,
      removed: filePatch.patch.removed,
    }))
    // Most-changed files first, so a capped tooltip shows what matters.
    .sort((a, b) => b.added + b.removed - (a.added + a.removed));
  const added = artifact.reduce((sum, filePatch) => sum + filePatch.patch.added, 0);
  const removed = artifact.reduce((sum, filePatch) => sum + filePatch.patch.removed, 0);
  const renderedLines = artifact.reduce(
    (sum, filePatch) =>
      sum + filePatch.patch.hunks.reduce((lines, hunk) => lines + hunk.lines.length, 0),
    0
  );
  const inlineEligible =
    artifact.length <= INLINE_DIFF_MAX_FILES &&
    added + removed <= INLINE_DIFF_MAX_CHANGED_LINES &&
    renderedLines > 0 &&
    renderedLines <= INLINE_DIFF_MAX_RENDERED_LINES;
  return {
    patchStats: {fileList, files: artifact.length, added, removed},
    inlinePatches: inlineEligible
      ? artifact.map(filePatch => ({
          patch: filePatch.patch,
          repoName: multiRepo ? filePatch.repo_name : undefined,
        }))
      : undefined,
  };
}

function extractPr(
  state: ExplorerAutofixState | null
): Pick<OverviewRow, 'prNumber' | 'prUrl'> {
  const pr = Object.values(state?.repo_pr_states ?? {}).find(
    repoPr => repoPr.pr_creation_status === 'completed' && repoPr.pr_url
  );
  return pr ? {prUrl: pr.pr_url ?? undefined, prNumber: pr.pr_number ?? undefined} : {};
}

// The pending-input payload is untyped (Record<string, unknown>). The canonical
// ask_user_question shape is {questions: [{question, options}]} (see
// usePendingUserInput's AskUserQuestionData); fall back to a flat key otherwise.
export function extractPendingQuestion(
  state: ExplorerAutofixState | null
): string | undefined {
  if (state?.status !== 'awaiting_user_input') {
    return undefined;
  }
  const data = state.pending_user_input?.data ?? {};
  if (Array.isArray(data.questions)) {
    const [first] = data.questions as Array<{question?: unknown}>;
    if (typeof first?.question === 'string' && first.question.trim()) {
      return first.question;
    }
  }
  for (const key of ['question', 'text', 'message']) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return undefined;
}

// A headline longer than this means the model ignored the 14-word instruction
// (or the pipe landed somewhere unintended) — treat it as a parse failure.
const MAX_HEADLINE_LENGTH = 140;

// The root_cause prompt asks for "headline|root cause". Split on the first
// pipe; strip stray emphasis/quote characters the model might wrap it in.
export function parseRootCause(answer: string): {answer: string; headline?: string} {
  const pipeIndex = answer.indexOf('|');
  if (pipeIndex === -1) {
    return {answer};
  }
  const headline = answer
    .slice(0, pipeIndex)
    .trim()
    .replace(/^["'*_]+|["'*_]+$/g, '');
  const rootCause = answer.slice(pipeIndex + 1).trim();
  if (!headline || headline.length > MAX_HEADLINE_LENGTH || !rootCause) {
    return {answer};
  }
  return {answer: rootCause, headline};
}

// The model sometimes emits inline "•" bullets run together in one paragraph;
// markdown only renders a list when each item is its own "- " line. The bullet
// may be followed by no space ("•Item"), so the trailing \s is optional.
export function normalizeBulletList(answer: string): string {
  if (!answer.includes('•')) {
    return answer;
  }
  const [head = '', ...items] = answer.split(/\s*•\s*/);
  const bullets = items
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => `- ${item}`);
  return [head.trim(), ...bullets].filter(Boolean).join('\n');
}

/**
 * Join the run's answered questions back to their question configs.
 *
 * Matches primarily on the echoed question text (the endpoint echoes prompts
 * back for user-supplied questions), falling back to position — answers are
 * returned in question order. Empty answers mean "not applicable" (the prompts
 * ask for an empty string) and are dropped.
 */
export function buildAnalysis(outputs: RunQuestion[] | undefined): {
  entries: RunAnalysisEntry[];
  headline?: string;
} {
  if (!outputs?.length) {
    return {entries: []};
  }
  const byPrompt = new Map(RUN_QUESTIONS.map(question => [question.prompt, question]));
  const entries: RunAnalysisEntry[] = [];
  let headline: string | undefined;
  outputs.forEach((output, index) => {
    const config =
      (output.question ? byPrompt.get(output.question) : undefined) ??
      RUN_QUESTIONS[index];
    if (!config || !output.answer) {
      return;
    }
    let answer = output.answer;
    if (config.key === 'root_cause') {
      const rootCause = parseRootCause(output.answer);
      headline = rootCause.headline;
      answer = rootCause.answer;
    } else if (config.key === 'next_steps') {
      answer = normalizeBulletList(output.answer);
    }
    entries.push({
      key: config.key,
      label: config.label,
      answer,
    });
  });
  return {entries, headline};
}

export function mostRecentTimestamp(
  ...candidates: Array<string | null | undefined>
): string {
  let latest = '';
  let latestTime = -Infinity;
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const time = new Date(candidate).getTime();
    if (time > latestTime) {
      latest = candidate;
      latestTime = time;
    }
  }
  return latest;
}

export function buildOverviewRow(
  issue: OverviewIssue,
  run: SeerRun | null,
  state: ExplorerAutofixState | null,
  statePending: boolean,
  statsPeriod: string
): OverviewRow {
  const eventCount = Number(issue.count);
  const {entries: analysis, headline} = buildAnalysis(run?.outputs);

  return {
    headline,
    id: issue.id,
    shortId: issue.shortId,
    title: issue.title,
    level: issue.level,
    project: issue.project,
    eventCount: Number.isFinite(eventCount) ? eventCount : 0,
    userCount: issue.userCount,
    statsPeriod,
    lastActivityAt: mostRecentTimestamp(
      state?.updated_at,
      run?.lastTriggeredAt,
      issue.seerAutofixLastTriggered,
      issue.lastSeen
    ),
    runStatus: state?.status ?? null,
    statePending,
    trigger: mapRunSourceToTrigger(run?.source ?? null),
    rawSource: run?.source ?? null,
    analysis,
    ...extractPatchInfo(state),
    pendingQuestion: extractPendingQuestion(state),
    ...extractPr(state),
  };
}
