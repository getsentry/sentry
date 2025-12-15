import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Container} from '@sentry/scraps/layout/container';
import {Flex} from '@sentry/scraps/layout/flex';

import {Button} from 'sentry/components/core/button';
import {Text} from 'sentry/components/core/text';
import type {AutofixExplorerStep} from 'sentry/components/events/autofix/useExplorerAutofix';
import {cardAnimationProps} from 'sentry/components/events/autofix/v2/utils';
import {IconChat} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Artifact} from 'sentry/views/seerExplorer/types';

const STEP_LABELS: Record<AutofixExplorerStep, string> = {
  root_cause: t('Find Root Cause'),
  solution: t('Plan a Solution'),
  code_changes: t('Write a Code Fix'),
  impact_assessment: t('Assess the Impact'),
  triage: t('Triage the Issue'),
};

interface ExplorerNextStepsProps {
  /**
   * Current artifacts that have been generated.
   */
  artifacts: Record<string, Artifact>;
  /**
   * Whether there are code changes available.
   */
  hasCodeChanges: boolean;
  /**
   * Callback when a step button is clicked.
   */
  onStartStep: (step: AutofixExplorerStep) => void;
  /**
   * Whether an action is currently loading.
   */
  isLoading?: boolean;
  /**
   * Callback when the open chat button is clicked.
   */
  onOpenChat?: () => void;
}

/**
 * Get the available next steps based on current artifacts.
 *
 * After root cause is complete, all other steps become available.
 */
function getAvailableNextSteps(
  artifacts: Record<string, Artifact>,
  hasCodeChanges: boolean
): AutofixExplorerStep[] {
  const hasRootCause = 'root_cause' in artifacts;
  const hasSolution = 'solution' in artifacts;
  const hasImpact = 'impact_assessment' in artifacts;
  const hasTriage = 'triage' in artifacts;

  if (!hasRootCause) {
    // Only root cause is available initially
    return [];
  }

  // After root cause, all steps become available (except ones already completed)
  const available: AutofixExplorerStep[] = [];

  if (!hasSolution) {
    available.push('solution');
  }

  // Only show code changes if they don't already exist
  if (!hasCodeChanges) {
    available.push('code_changes');
  }

  if (!hasImpact) {
    available.push('impact_assessment');
  }

  if (!hasTriage) {
    available.push('triage');
  }

  return available;
}

/**
 * Next steps buttons shown when an autofix run is completed.
 *
 * Shows available actions based on which artifacts have been generated.
 */
export function ExplorerNextSteps({
  artifacts,
  hasCodeChanges,
  onStartStep,
  onOpenChat,
  isLoading,
}: ExplorerNextStepsProps) {
  const availableSteps = getAvailableNextSteps(artifacts, hasCodeChanges);
  const [busyStep, setBusyStep] = useState<AutofixExplorerStep | null>(null);

  // Clear busy state when loading starts (step is triggered)
  useEffect(() => {
    if (isLoading && busyStep) {
      setBusyStep(null);
    }
  }, [isLoading, busyStep]);

  // Clear busy state when the specific artifact for the busy step appears
  useEffect(() => {
    if (busyStep && busyStep in artifacts) {
      setBusyStep(null);
    }
  }, [artifacts, busyStep]);

  const handleStepClick = (step: AutofixExplorerStep) => {
    setBusyStep(step);
    onStartStep(step);
  };

  return (
    <AnimatePresence initial={false}>
      <AnimatedNextSteps {...cardAnimationProps}>
        <Container border="primary" radius="md" background="primary" padding="lg">
          {availableSteps.length > 0 ? (
            <Flex direction="column" gap="xl">
              <Flex gap="md">
                <Text size="md" variant="muted">
                  {t('Tell Seer what to do next...')}
                </Text>
              </Flex>
              <Flex gap="md">
                {availableSteps.map((step, index) => (
                  <Button
                    key={step}
                    onClick={() => handleStepClick(step)}
                    disabled={isLoading}
                    busy={busyStep === step}
                    priority={index === 0 ? 'primary' : 'default'}
                  >
                    {STEP_LABELS[step]}
                  </Button>
                ))}
              </Flex>
              <Text size="md" variant="muted">
                {t("Or read and chat about what's already on the page...")}
              </Text>
              <Flex gap="md">
                <Button
                  size="md"
                  onClick={onOpenChat}
                  priority="primary"
                  icon={<IconChat />}
                >
                  {t('Open Chat')}
                </Button>
              </Flex>
            </Flex>
          ) : (
            <Flex direction="column" gap="xl">
              <Text size="md" variant="muted">
                {t("Read and chat about Seer's analysis...")}
              </Text>
              <Flex gap="md">
                <Button
                  size="md"
                  onClick={onOpenChat}
                  priority="primary"
                  icon={<IconChat />}
                >
                  {t('Open Chat')}
                </Button>
              </Flex>
            </Flex>
          )}
        </Container>
      </AnimatedNextSteps>
    </AnimatePresence>
  );
}

const AnimatedNextSteps = styled(motion.div)`
  transform-origin: top center;
`;
