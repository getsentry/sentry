import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  countOccurrences,
  dedupeConsecutiveSteps,
  formatStep,
  normalizeStepKey,
} from './askSeerStepUtils';
import type {AskSeerStep} from './types';

interface AskSeerProgressBlocksProps {
  completedSteps: AskSeerStep[];
  currentStep: AskSeerStep | null;
}

/**
 * Component to display progress steps from the search agent.
 * Shows completed and in-progress steps.
 */
export function AskSeerProgressBlocks({
  completedSteps,
  currentStep,
}: AskSeerProgressBlocksProps) {
  // Dedupe consecutive steps (parallel tool calls show as single step)
  const dedupedSteps = dedupeConsecutiveSteps(completedSteps);

  // Don't render if no steps to show
  if (dedupedSteps.length === 0 && !currentStep) {
    return null;
  }

  // Don't show current step if it's the same as the last completed step
  const lastCompletedStep = dedupedSteps[dedupedSteps.length - 1];
  const currentStepKey = currentStep ? normalizeStepKey(currentStep) : null;
  const lastCompletedKey = lastCompletedStep ? normalizeStepKey(lastCompletedStep) : null;
  const showCurrentStep = currentStep && currentStepKey !== lastCompletedKey;

  // Count how many times the current step's key has appeared in deduped completed steps
  const currentStepOccurrence =
    currentStep && showCurrentStep && currentStepKey
      ? dedupedSteps.filter(s => normalizeStepKey(s) === currentStepKey).length
      : 0;

  return (
    <ProgressContainer>
      {dedupedSteps.map((step, idx) => {
        const normalizedKey = normalizeStepKey(step);
        const occurrence = countOccurrences(dedupedSteps, normalizedKey, idx);
        return (
          <Flex key={`${normalizedKey}-${idx}`} align="center" gap="sm">
            <CompletedDot />
            <Text variant="muted">{formatStep(step, false, occurrence)}</Text>
          </Flex>
        );
      })}
      {showCurrentStep && (
        <Flex align="center" gap="sm">
          <LoadingDot />
          <Text>{formatStep(currentStep, true, currentStepOccurrence)}</Text>
        </Flex>
      )}
    </ProgressContainer>
  );
}

const ProgressContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

const CompletedDot = styled('div')`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${p => p.theme.tokens.background.success.vibrant};
`;

const LoadingDot = styled('div')`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${p => p.theme.tokens.background.promotion.vibrant};
  animation: blink 1s infinite;

  @keyframes blink {
    0%,
    50% {
      opacity: 1;
    }
    51%,
    100% {
      opacity: 0.3;
    }
  }
`;
