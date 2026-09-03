import {markdownToPlainText} from 'sentry/utils/marked/marked';
import {ellipsize} from 'sentry/utils/string/ellipsize';
import type {
  InvestigationBlock,
  InvestigationDetail,
  InvestigationExecutionStatus,
} from 'sentry/views/investigations/types';

const UNDERSTANDING_PREVIEW_LENGTH = 320;
const INLINE_NEXT_STEP_PATTERN =
  /^(.*[.!?])\s+((?:(?:investigate|check|review|confirm|verify|compare|inspect|identify|trace|diff|consider|roll back|rollback|revert|monitor|validate|follow up)\b|the next step is\b|next,\s|recommended next step:)\s*.*)$/i;
const ACTIVE_EXECUTION_STATUSES: InvestigationExecutionStatus[] = [
  'pending',
  'running',
  'awaiting_input',
  'stopping',
];

export type InvestigationStepStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'blocked';

export type InvestigationStep = {
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
  id: string;
  startedAt: string | null;
  status: InvestigationStepStatus;
  title: string;
};

export type InvestigationCurrentState = {
  activeStepTitle: string | null;
  description: string;
  hasCurrentUnderstanding: boolean;
  phase: 'starting' | 'investigating' | 'stopped' | 'completed' | 'archived';
  steps: InvestigationStep[];
  suggestedNextSteps: string | null;
  title: string | null;
};

type StepGroup = {
  blocks: InvestigationBlock[];
  id: string;
  title: string;
};

export function buildInvestigationCurrentState(
  investigation: InvestigationDetail
): InvestigationCurrentState {
  const blocks = (investigation.blocks ?? []).toSorted(
    (left, right) => left.position - right.position
  );
  const groups = groupInvestigationBlocks(blocks);
  const steps = groups.map(group => buildStep(group, blocks));
  const latestFinding = getLatestCompletedFinding(blocks);
  const hasFinalUnderstanding = Boolean(
    investigation.summary && investigation.summaryDescription
  );
  const allStepsCompleted =
    steps.length > 0 && steps.every(step => step.status === 'completed');
  const hasRunningStep = steps.some(step => step.status === 'running');
  const hasQueuedStep = steps.some(step => step.status === 'queued');
  const hasStoppedStep = steps.some(step =>
    ['failed', 'cancelled', 'blocked'].includes(step.status)
  );

  let phase: InvestigationCurrentState['phase'] = 'investigating';
  if (hasFinalUnderstanding || allStepsCompleted) {
    phase = 'completed';
  } else if (investigation.status === 'archived') {
    phase = 'archived';
  } else if (hasStoppedStep && !hasRunningStep && !hasQueuedStep) {
    phase = 'stopped';
  } else if (!latestFinding && steps.every(step => step.status === 'queued')) {
    phase = 'starting';
  }

  const activeStep =
    steps.find(step => step.status === 'running') ??
    steps.find(step => step.status === 'failed') ??
    steps.find(step => step.status === 'queued') ??
    null;

  if (hasFinalUnderstanding) {
    const {description, suggestedNextSteps} = splitSummaryDescription(
      investigation.summaryDescription!
    );
    return {
      activeStepTitle: null,
      description,
      hasCurrentUnderstanding: true,
      phase,
      steps,
      suggestedNextSteps,
      title: investigation.summary!,
    };
  }

  return {
    activeStepTitle: activeStep?.title ?? null,
    description:
      latestFinding?.description ??
      'Seer is reviewing the investigation source and available evidence.',
    hasCurrentUnderstanding: Boolean(latestFinding),
    phase,
    steps,
    suggestedNextSteps: null,
    title: latestFinding?.title ?? null,
  };
}

function splitSummaryDescription(summaryDescription: string) {
  const [description = '', ...nextStepLines] = summaryDescription
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  if (nextStepLines.length === 0) {
    const inlineNextStep = description.match(INLINE_NEXT_STEP_PATTERN);
    if (inlineNextStep) {
      return {
        description: inlineNextStep[1]!,
        suggestedNextSteps: inlineNextStep[2]!,
      };
    }
  }

  return {
    description,
    suggestedNextSteps:
      nextStepLines.length > 0 ? nextStepLines.join(' · ') : null,
  };
}

function groupInvestigationBlocks(blocks: InvestigationBlock[]): StepGroup[] {
  const groups: StepGroup[] = [];
  let currentGroup: StepGroup | null = null;

  for (const block of blocks) {
    if (block.kind === 'text') {
      currentGroup = {
        blocks: [block],
        id: block.id,
        title: block.title.trim() || 'Untitled analysis step',
      };
      groups.push(currentGroup);
      continue;
    }

    if (currentGroup) {
      currentGroup.blocks.push(block);
      continue;
    }

    groups.push({
      blocks: [block],
      id: block.id,
      title: block.title.trim() || 'Untitled analysis step',
    });
  }

  return groups;
}

function buildStep(
  group: StepGroup,
  allBlocks: InvestigationBlock[]
): InvestigationStep {
  const statuses = group.blocks.map(block => getBlockStatus(block, allBlocks));
  let status: InvestigationStepStatus = 'queued';
  if (statuses.includes('failed')) {
    status = 'failed';
  } else if (statuses.includes('cancelled')) {
    status = 'cancelled';
  } else if (statuses.includes('blocked')) {
    status = 'blocked';
  } else if (statuses.every(blockStatus => blockStatus === 'completed')) {
    status = 'completed';
  } else if (
    statuses.includes('running') ||
    statuses.includes('completed')
  ) {
    status = 'running';
  }

  const startedDates = group.blocks.flatMap(block =>
    block.currentExecution?.startedAt ? [block.currentExecution.startedAt] : []
  );
  const completedDates = group.blocks.flatMap(block =>
    block.currentExecution?.completedAt ? [block.currentExecution.completedAt] : []
  );
  const startedAt = getBoundaryDate(startedDates, 'earliest');
  const completedAt = getBoundaryDate(completedDates, 'latest');
  const failedBlock = group.blocks.find(
    block => block.currentExecution?.status === 'failed'
  );

  return {
    completedAt,
    durationMs: getDurationMs(startedAt, completedAt),
    error: failedBlock?.currentExecution?.error?.message ?? null,
    id: group.id,
    startedAt,
    status,
    title: group.title,
  };
}

function getBlockStatus(
  block: InvestigationBlock,
  blocks: InvestigationBlock[]
): InvestigationStepStatus {
  const executionStatus = block.currentExecution?.status;
  if (executionStatus && ACTIVE_EXECUTION_STATUSES.includes(executionStatus)) {
    return 'running';
  }
  if (executionStatus === 'failed') {
    return 'failed';
  }
  if (executionStatus === 'cancelled') {
    return block.currentExecution?.error?.code === 'investigation_execution_failed'
      ? 'blocked'
      : 'cancelled';
  }
  if (hasFailedOrCancelledDependency(block, blocks)) {
    return 'blocked';
  }
  if (hasCurrentResult(block)) {
    return 'completed';
  }
  return 'queued';
}

function hasCurrentResult(block: InvestigationBlock) {
  if (
    block.outputStatus === 'available' ||
    block.outputStatus === 'completed' ||
    block.currentExecution?.status === 'completed' ||
    block.output !== null
  ) {
    return true;
  }
  return block.kind === 'text' && Boolean(block.content.trim());
}

function hasFailedOrCancelledDependency(
  block: InvestigationBlock,
  blocks: InvestigationBlock[],
  visited = new Set<string>()
): boolean {
  return block.dependencies.some(dependencyId => {
    if (visited.has(dependencyId)) {
      return false;
    }
    visited.add(dependencyId);
    const dependency = blocks.find(candidate => candidate.id === dependencyId);
    if (!dependency) {
      return false;
    }
    if (
      dependency.currentExecution?.status === 'failed' ||
      dependency.currentExecution?.status === 'cancelled'
    ) {
      return true;
    }
    return hasFailedOrCancelledDependency(dependency, blocks, visited);
  });
}

function getLatestCompletedFinding(blocks: InvestigationBlock[]) {
  const candidates = blocks
    .filter(block => block.kind === 'text' && hasCurrentResult(block))
    .map(block => {
      const markdown = getTextOutput(block);
      const description = markdown
        ? ellipsize(markdownToPlainText(markdown).replace(/\s+/g, ' ').trim(), UNDERSTANDING_PREVIEW_LENGTH)
        : '';
      return {
        completedAt: block.currentExecution?.completedAt
          ? Date.parse(block.currentExecution.completedAt)
          : Number.NaN,
        description,
        position: block.position,
        title: block.title.trim() || null,
      };
    })
    .filter(candidate => candidate.description);

  return candidates.sort((left, right) => {
    const leftCompletedAt = Number.isFinite(left.completedAt)
      ? left.completedAt
      : left.position;
    const rightCompletedAt = Number.isFinite(right.completedAt)
      ? right.completedAt
      : right.position;
    return rightCompletedAt - leftCompletedAt;
  })[0];
}

function getTextOutput(block: InvestigationBlock): string | null {
  if (
    block.output &&
    typeof block.output === 'object' &&
    'markdown' in block.output &&
    typeof block.output.markdown === 'string'
  ) {
    return block.output.markdown;
  }
  return block.content.trim() || null;
}

function getBoundaryDate(values: string[], boundary: 'earliest' | 'latest') {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((selected, value) => {
    const selectedTime = Date.parse(selected);
    const valueTime = Date.parse(value);
    return boundary === 'earliest'
      ? valueTime < selectedTime
        ? value
        : selected
      : valueTime > selectedTime
        ? value
        : selected;
  });
}

function getDurationMs(startedAt: string | null, completedAt: string | null) {
  if (!startedAt || !completedAt) {
    return null;
  }
  const duration = Date.parse(completedAt) - Date.parse(startedAt);
  return Number.isFinite(duration) && duration >= 0 ? duration : null;
}
