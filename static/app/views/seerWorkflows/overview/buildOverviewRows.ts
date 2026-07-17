import {
  type ExplorerAutofixState,
  getAutofixArtifactFromSection,
  getOrderedAutofixSections,
  isCodeChangesArtifact,
  isCodeChangesSection,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {
  AutofixIssue,
  RunQuestion,
} from 'sentry/views/autofixIssuesDemo/useAutofixIssues';

import {RUN_QUESTIONS} from './runQuestions';
import {mapRunSourceToTrigger} from './triggerBadge';
import type {
  AutofixOutcome,
  AutofixRunStatus,
  OverviewRow,
  PatchStats,
  RunAnalysisEntry,
} from './types';

const OUTCOME_ORDER: AutofixOutcome[] = [
  'root_cause',
  'solution',
  'code_changes',
  'pr_opened',
];

/**
 * Every pipeline stage the run has produced so far, in stage order.
 *
 * Cumulative (unlike deriveAutofixPhase's single furthest phase) because the
 * attention logic tests stage membership: "code changes but no PR" is a
 * different action than "PR opened".
 */
function deriveAutofixOutcomes(runState: ExplorerAutofixState | null): AutofixOutcome[] {
  const reached = new Set<AutofixOutcome>();
  for (const section of getOrderedAutofixSections(runState)) {
    switch (section.step) {
      case 'root_cause':
        reached.add('root_cause');
        break;
      case 'solution':
        reached.add('solution');
        break;
      case 'code_changes':
      case 'coding_agents':
        reached.add('code_changes');
        break;
      case 'pull_request':
        reached.add('pr_opened');
        break;
      default:
        break;
    }
  }
  return OUTCOME_ORDER.filter(outcome => reached.has(outcome));
}

function deriveRunStatus(state: ExplorerAutofixState | null): AutofixRunStatus {
  switch (state?.status) {
    case 'awaiting_user_input':
      return 'NEED_MORE_INFORMATION';
    case 'error':
      return 'ERROR';
    default:
      return 'COMPLETED';
  }
}

function extractPatchStats(state: ExplorerAutofixState | null): PatchStats | undefined {
  const section = getOrderedAutofixSections(state).find(isCodeChangesSection);
  if (!section) {
    return undefined;
  }
  const artifact = getAutofixArtifactFromSection(section);
  if (!isCodeChangesArtifact(artifact)) {
    return undefined;
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
  return {
    fileList,
    files: artifact.length,
    added: artifact.reduce((sum, filePatch) => sum + filePatch.patch.added, 0),
    removed: artifact.reduce((sum, filePatch) => sum + filePatch.patch.removed, 0),
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
function extractPendingQuestion(state: ExplorerAutofixState | null): string | undefined {
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

/**
 * Join the run's answered questions back to their question configs.
 *
 * Matches primarily on the echoed question text (the endpoint echoes prompts
 * back for user-supplied questions), falling back to position — answers are
 * returned in question order. Empty answers mean "not applicable" (the prompts
 * ask for an empty string) and are dropped.
 */
// A headline longer than this means the model ignored the 14-word instruction
// (or the pipe landed somewhere unintended) — treat it as a parse failure.
const MAX_HEADLINE_LENGTH = 140;

// The root_cause prompt asks for "headline|root cause". Split on the first
// pipe; strip stray emphasis/quote characters the model might wrap it in.
function parseRootCause(answer: string): {answer: string; headline?: string} {
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
function normalizeBulletList(answer: string): string {
  if (!answer.includes('•')) {
    return answer;
  }
  const [head = '', ...items] = answer.split(/\s*•\s*/);
  return [head.trim(), ...items.map(item => `- ${item.trim()}`)]
    .filter(Boolean)
    .join('\n');
}

function buildAnalysis(outputs: RunQuestion[] | undefined): {
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
    } else if (config.key === 'reviewer_notes') {
      answer = normalizeBulletList(output.answer);
    }
    entries.push({
      key: config.key,
      label: config.label,
      placement: config.placement,
      answer,
    });
  });
  return {entries, headline};
}

function buildOverviewRow(issue: AutofixIssue): OverviewRow {
  const state = issue.autofixState;
  const eventCount = Number(issue.count);
  const {entries: analysis, headline} = buildAnalysis(issue.run?.outputs);

  return {
    headline,
    id: issue.id,
    shortId: issue.shortId,
    title: issue.title,
    level: issue.level,
    project: issue.project,
    eventCount: Number.isFinite(eventCount) ? eventCount : 0,
    userCount: issue.userCount,
    lastSeen: issue.lastSeen,
    fixabilityScore: issue.seerFixabilityScore,
    lastActivityAt:
      state?.updated_at ??
      issue.run?.lastTriggeredAt ??
      issue.seerAutofixLastTriggered ??
      issue.lastSeen,
    autofixRunStatus: deriveRunStatus(state),
    prMerged: (issue.run?.pullRequests ?? []).some(pr => pr.status === 'merged'),
    isProcessing: state?.status === 'processing',
    statePending: issue.autofixPhasePending,
    outcomes: deriveAutofixOutcomes(state),
    trigger: mapRunSourceToTrigger(issue.run?.source ?? null),
    rawSource: issue.run?.source ?? null,
    analysis,
    patchStats: extractPatchStats(state),
    pendingQuestion: extractPendingQuestion(state),
    ...extractPr(state),
  };
}

export function buildOverviewRows(issues: AutofixIssue[]): OverviewRow[] {
  return issues.map(buildOverviewRow);
}
