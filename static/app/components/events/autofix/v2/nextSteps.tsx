import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Container} from '@sentry/scraps/layout/container';
import {Flex} from '@sentry/scraps/layout/flex';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Text} from 'sentry/components/core/text';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {useCodingAgentIntegrations} from 'sentry/components/events/autofix/useAutofix';
import type {AutofixExplorerStep} from 'sentry/components/events/autofix/useExplorerAutofix';
import {cardAnimationProps} from 'sentry/components/events/autofix/v2/utils';
import {IconChat, IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
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
   * Whether there are coding agents already launched.
   */
  hasCodingAgents?: boolean;
  /**
   * Whether an action is currently loading.
   */
  isLoading?: boolean;
  /**
   * Callback when a coding agent handoff is requested.
   */
  onCodingAgentHandoff?: (integrationId: number) => void;
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
  hasCodeChanges: boolean,
  hasCodingAgents: boolean
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

  // Don't show "Plan a Solution" if code changes have been initiated
  if (!hasSolution && !hasCodeChanges && !hasCodingAgents) {
    available.push('solution');
  }

  // Only show code changes if they don't already exist and no coding agents are launched
  if (!hasCodeChanges && !hasCodingAgents) {
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
 * Renders a step button with optional dropdown for coding agent integrations.
 */
function StepButton({
  step,
  index,
  isLoading,
  isBusy,
  codingAgentIntegrations,
  onStepClick,
  onCodingAgentHandoff,
}: {
  index: number;
  isBusy: boolean;
  onStepClick: () => void;
  step: AutofixExplorerStep;
  codingAgentIntegrations?: Array<{id: string; name: string; provider: string}>;
  isLoading?: boolean;
  onCodingAgentHandoff?: (integrationId: number) => void;
}) {
  const priority = index === 0 ? 'primary' : 'default';

  // Only show dropdown for code_changes step when integrations are available
  if (step !== 'code_changes' || !codingAgentIntegrations?.length) {
    return (
      <Button
        onClick={onStepClick}
        disabled={isLoading}
        busy={isBusy}
        priority={priority}
      >
        {STEP_LABELS[step]}
      </Button>
    );
  }

  // Build dropdown items for coding agent integrations
  const dropdownItems = codingAgentIntegrations.map(integration => ({
    key: `agent:${integration.id}`,
    label: (
      <Flex gap="md" align="center">
        <PluginIcon pluginId="cursor" size={16} />
        <span>{t('Send to %s', integration.name)}</span>
      </Flex>
    ),
    onAction: () => onCodingAgentHandoff?.(parseInt(integration.id, 10)),
  }));

  return (
    <ButtonBar merged gap="0">
      <Button
        onClick={onStepClick}
        disabled={isLoading}
        busy={isBusy}
        priority={priority}
      >
        {STEP_LABELS[step]}
      </Button>
      <DropdownMenu
        items={dropdownItems}
        trigger={(triggerProps, isOpen) => (
          <DropdownTrigger
            {...triggerProps}
            disabled={isLoading}
            priority={priority}
            icon={<IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />}
            aria-label={t('More code fix options')}
          />
        )}
        position="bottom-end"
      />
    </ButtonBar>
  );
}

/**
 * Next steps buttons shown when an autofix run is completed.
 *
 * Shows available actions based on which artifacts have been generated.
 */
export function ExplorerNextSteps({
  artifacts,
  hasCodeChanges,
  hasCodingAgents = false,
  onStartStep,
  onCodingAgentHandoff,
  onOpenChat,
  isLoading,
}: ExplorerNextStepsProps) {
  const {data: codingAgentResponse} = useCodingAgentIntegrations();
  const codingAgentIntegrations = codingAgentResponse?.integrations ?? [];

  const availableSteps = getAvailableNextSteps(
    artifacts,
    hasCodeChanges,
    hasCodingAgents
  );
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
              <Flex gap="md" wrap="wrap">
                {availableSteps.map((step, index) => (
                  <StepButton
                    key={step}
                    step={step}
                    index={index}
                    isLoading={isLoading}
                    isBusy={busyStep === step}
                    codingAgentIntegrations={codingAgentIntegrations}
                    onStepClick={() => handleStepClick(step)}
                    onCodingAgentHandoff={onCodingAgentHandoff}
                  />
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

const DropdownTrigger = styled(Button)`
  box-shadow: none;
  border-radius: 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0;
  border-left: none;
`;
