import styled from '@emotion/styled';
import {type MotionNodeAnimationOptions} from 'framer-motion';

import {inlineCodeStyles} from 'sentry/components/core/code/inlineCode';
import type {
  ImpactAssessmentArtifact,
  RootCauseArtifact,
  SolutionArtifact,
  TriageArtifact,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {MarkedText} from 'sentry/utils/marked/markedText';
import testableTransition from 'sentry/utils/testableTransition';

/**
 * Animation props for artifact cards and status cards.
 */
export const cardAnimationProps: MotionNodeAnimationOptions = {
  exit: {opacity: 0, height: 0, scale: 0.8, y: -20},
  initial: {opacity: 0, height: 0, scale: 0.8},
  animate: {opacity: 1, height: 'auto', scale: 1},
  transition: testableTransition({
    duration: 0.12,
    height: {
      type: 'spring',
      bounce: 0.2,
    },
    scale: {
      type: 'spring',
      bounce: 0.2,
    },
    y: {
      type: 'tween',
      ease: 'easeOut',
    },
  }),
};

/**
 * Styled MarkedText component with inline code styling.
 * Used for rendering markdown content in artifact cards and status cards.
 */
export const StyledMarkedText = styled(MarkedText)`
  code:not(pre code) {
    ${p => inlineCodeStyles(p.theme)};
  }
`;

/**
 * Format root cause artifact as markdown.
 */
function formatRootCauseArtifactToMarkdown(rootCause: RootCauseArtifact): string {
  const parts: string[] = ['# Root Cause of the Issue'];

  if (rootCause.one_line_description) {
    parts.push(rootCause.one_line_description);
  }

  if (rootCause.five_whys && rootCause.five_whys.length > 0) {
    parts.push('## Five Whys Analysis');
    rootCause.five_whys.forEach((why, index) => {
      parts.push(`${index + 1}. ${why}`);
    });
  }

  if (rootCause.reproduction_steps && rootCause.reproduction_steps.length > 0) {
    parts.push('## Reproduction Steps');
    rootCause.reproduction_steps.forEach((step, index) => {
      parts.push(`${index + 1}. ${step}`);
    });
  }

  return parts.join('\n\n');
}

/**
 * Format solution artifact as markdown.
 */
function formatSolutionArtifactToMarkdown(solution: SolutionArtifact): string {
  const parts: string[] = ['# Solution Plan'];

  if (solution.one_line_summary) {
    parts.push(solution.one_line_summary);
  }

  if (solution.steps && solution.steps.length > 0) {
    parts.push('## Solution Steps');
    solution.steps.forEach((step, index) => {
      parts.push(`### ${index + 1}. ${step.title}`);
      if (step.description) {
        parts.push(step.description);
      }
    });
  }

  return parts.join('\n\n');
}

/**
 * Format impact assessment artifact as markdown.
 */
function formatImpactAssessmentArtifactToMarkdown(
  impactAssessment: ImpactAssessmentArtifact
): string {
  const parts: string[] = ['# Impact Assessment'];

  if (impactAssessment.one_line_description) {
    parts.push(impactAssessment.one_line_description);
  }

  if (impactAssessment.impacts && impactAssessment.impacts.length > 0) {
    // Sort impacts by rating: high > medium > low
    const sortedImpacts = [...impactAssessment.impacts].sort((a, b) => {
      const ratingOrder: Record<'high' | 'medium' | 'low', number> = {
        high: 0,
        medium: 1,
        low: 2,
      };
      return ratingOrder[a.rating] - ratingOrder[b.rating];
    });

    parts.push('## Impacts');
    sortedImpacts.forEach((impact, index) => {
      parts.push(`### ${index + 1}. ${impact.label} (${impact.rating})`);
      if (impact.impact_description) {
        parts.push(impact.impact_description);
      }
      if (impact.evidence) {
        parts.push(`**Evidence:** ${impact.evidence}`);
      }
    });
  }

  return parts.join('\n\n');
}

/**
 * Format triage artifact as markdown.
 */
function formatTriageArtifactToMarkdown(triage: TriageArtifact): string {
  const parts: string[] = ['# Triage'];

  if (triage.suspect_commit) {
    parts.push('## Suspect Commit');
    parts.push(`**SHA:** ${triage.suspect_commit.sha}`);
    if (triage.suspect_commit.description) {
      parts.push(`**Description:** ${triage.suspect_commit.description}`);
    }
  }

  if (triage.suggested_assignee) {
    parts.push('## Suggested Assignee');
    parts.push(`**Name:** ${triage.suggested_assignee.name}`);
    if (triage.suggested_assignee.email) {
      parts.push(`**Email:** ${triage.suggested_assignee.email}`);
    }
    if (triage.suggested_assignee.why) {
      parts.push(`**Reason:** ${triage.suggested_assignee.why}`);
    }
  }

  return parts.join('\n\n');
}

/**
 * Format basic issue information (title, message, transaction) as markdown.
 */
function formatIssueDetails(group?: Group, event?: Event): string {
  const parts: string[] = ['# Issue Details'];

  if (group?.title) {
    parts.push(`**Title:** ${group.title}`);
  }

  if (event?.message) {
    parts.push(`**Message:** ${event.message}`);
  }

  // Transaction might be on event.transaction (for EventTransaction) or in tags
  let transaction: string | undefined;
  if (event) {
    if ('transaction' in event && typeof event.transaction === 'string') {
      transaction = event.transaction;
    } else {
      const transactionTag = event.tags?.find(tag => tag.key === 'transaction');
      transaction =
        typeof transactionTag?.value === 'string' ? transactionTag.value : undefined;
    }
  }
  if (transaction) {
    parts.push(`**Transaction:** ${transaction}`);
  }

  return parts.join('\n\n');
}

/**
 * Format artifacts and event details as markdown for copying.
 */
export function formatArtifactsToMarkdown(
  artifacts: Record<string, {data: Record<string, unknown> | null}>,
  group?: Group,
  event?: Event
): string {
  const parts: string[] = [];

  // Add root cause if available
  if (artifacts.root_cause?.data) {
    const rootCause = artifacts.root_cause.data as unknown as RootCauseArtifact;
    parts.push(formatRootCauseArtifactToMarkdown(rootCause));
  }

  // Add solution if available
  if (artifacts.solution?.data) {
    const solution = artifacts.solution.data as unknown as SolutionArtifact;
    if (parts.length > 0) {
      parts.push(''); // Add spacing between sections
    }
    parts.push(formatSolutionArtifactToMarkdown(solution));
  }

  // Add impact assessment if available
  if (artifacts.impact_assessment?.data) {
    const impactAssessment = artifacts.impact_assessment
      .data as unknown as ImpactAssessmentArtifact;
    if (parts.length > 0) {
      parts.push(''); // Add spacing between sections
    }
    parts.push(formatImpactAssessmentArtifactToMarkdown(impactAssessment));
  }

  // Add triage if available
  if (artifacts.triage?.data) {
    const triage = artifacts.triage.data as unknown as TriageArtifact;
    if (parts.length > 0) {
      parts.push(''); // Add spacing between sections
    }
    parts.push(formatTriageArtifactToMarkdown(triage));
  }

  // Add issue details (title, message, transaction) if available
  if (group || event) {
    if (parts.length > 0) {
      parts.push(''); // Add spacing between sections
    }
    parts.push(formatIssueDetails(group, event));
  }

  return parts.join('\n\n');
}
