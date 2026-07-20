import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';

import {dedupeConsecutiveSteps, formatStep, normalizeStepKey} from './askSeerStepUtils';
import type {AskSeerStep} from './types';

interface AskSeerLoadingStatusProps {
  completedSteps: AskSeerStep[];
  currentStep: AskSeerStep | null;
}

export function AskSeerLoadingStatus({
  completedSteps,
  currentStep,
}: AskSeerLoadingStatusProps) {
  const dedupedSteps = dedupeConsecutiveSteps(completedSteps);
  const currentStepOccurrence = currentStep
    ? dedupedSteps.filter(
        step => normalizeStepKey(step) === normalizeStepKey(currentStep)
      ).length
    : 0;
  const status = currentStep
    ? formatStep(currentStep, true, currentStepOccurrence)
    : t("I'm on it...");

  return (
    <Flex
      align="center"
      gap="md"
      padding="md xl"
      width="100%"
      minWidth="0"
      role="status"
      aria-live="polite"
    >
      <LoadingIndicator size={16} style={{margin: 0}} />
      <Text ellipsis monospace variant="muted">
        {status}
      </Text>
    </Flex>
  );
}
