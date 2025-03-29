import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Chevron} from 'sentry/components/chevron';
import {Button} from 'sentry/components/core/button';
import {
  AutofixStatus,
  type AutofixStep,
  AutofixStepType,
} from 'sentry/components/events/autofix/types';
import {useAiAutofix, useAutofixData} from 'sentry/components/events/autofix/useAutofix';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useOpenSeerDrawer} from 'sentry/views/issueDetails/streamline/sidebar/seerDrawer';

interface Props {
  aiConfig: {
    hasAutofix: boolean | null | undefined;
    hasResources: boolean;
    hasSummary: boolean;
    isAutofixSetupLoading: boolean;
    needsGenAIConsent: boolean;
  };
  event: Event;
  group: Group;
  hasStreamlinedUI: boolean;
  project: Project;
}

export function SeerSectionCtaButton({
  aiConfig,
  event,
  group,
  project,
  hasStreamlinedUI,
}: Props) {
  const openButtonRef = useRef<HTMLButtonElement>(null);

  const {isPending: isAutofixPending} = useAutofixData({groupId: group.id});
  const {autofixData} = useAiAutofix(group, event, {isSidebar: true, pollInterval: 1500});

  const openSeerDrawer = useOpenSeerDrawer(group, project, event, openButtonRef);
  const isDrawerOpenRef = useRef(false);

  // Keep track of previous steps to detect state transitions and notify the user
  const prevStepsRef = useRef<AutofixStep[] | null>(null);
  const prevRunIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (isDrawerOpenRef.current) {
      return;
    }

    if (!autofixData?.steps || !prevStepsRef.current) {
      prevStepsRef.current = autofixData?.steps ?? null;
      prevRunIdRef.current = autofixData?.run_id ?? null;
      return;
    }

    const prevSteps = prevStepsRef.current;
    const currentSteps = autofixData.steps;

    // Don't show notifications if the run_id has changed
    if (
      prevStepsRef.current !== currentSteps &&
      autofixData?.run_id !== prevRunIdRef.current
    ) {
      prevStepsRef.current = currentSteps;
      prevRunIdRef.current = autofixData?.run_id;
      return;
    }

    // Find the most recent step
    const processingStep = currentSteps.findLast(
      step => step.type === AutofixStepType.DEFAULT
    );

    if (processingStep && processingStep.status === AutofixStatus.COMPLETED) {
      // Check if this is a new completion (wasn't completed in previous state)
      const prevProcessingStep = prevSteps.findLast(
        step => step.type === AutofixStepType.DEFAULT
      );
      if (prevProcessingStep && prevProcessingStep.status !== AutofixStatus.COMPLETED) {
        if (currentSteps.find(step => step.type === AutofixStepType.CHANGES)) {
          addSuccessMessage(t('Autofix has finished coding.'));
        } else if (currentSteps.find(step => step.type === AutofixStepType.SOLUTION)) {
          addSuccessMessage(t('Autofix has found a solution.'));
        } else if (
          currentSteps.find(step => step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS)
        ) {
          addSuccessMessage(t('Autofix has found the root cause.'));
        }
      }
    }

    prevStepsRef.current = autofixData?.steps ?? null;
    prevRunIdRef.current = autofixData?.run_id ?? null;
  }, [autofixData?.steps, autofixData?.run_id]);

  // Update drawer state when opening
  const handleOpenDrawer = () => {
    isDrawerOpenRef.current = true;
    openSeerDrawer();
  };

  // Listen for drawer close events
  useEffect(() => {
    const handleClickOutside = () => {
      isDrawerOpenRef.current = false;
    };

    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const showCtaButton =
    aiConfig.needsGenAIConsent ||
    aiConfig.hasAutofix ||
    (aiConfig.hasSummary && aiConfig.hasResources);
  const isButtonLoading = aiConfig.isAutofixSetupLoading || isAutofixPending;

  const lastStep = autofixData?.steps?.[autofixData.steps.length - 1];
  const isAutofixInProgress = lastStep?.status === AutofixStatus.PROCESSING;
  const isAutofixCompleted = lastStep?.status === AutofixStatus.COMPLETED;
  const isAutofixWaitingForUser =
    autofixData?.status === AutofixStatus.WAITING_FOR_USER_RESPONSE;

  const hasStepType = (type: AutofixStepType) =>
    autofixData?.steps?.some(step => step.type === type);

  const getButtonText = () => {
    if (aiConfig.needsGenAIConsent) {
      return t('Set Up Autofix');
    }

    if (!aiConfig.hasAutofix) {
      return t('Open Resources');
    }

    if (!lastStep) {
      return t('Find Root Cause');
    }

    if (isAutofixWaitingForUser) {
      return t('Waiting for Your Input');
    }

    if (isAutofixInProgress) {
      if (!hasStepType(AutofixStepType.ROOT_CAUSE_ANALYSIS)) {
        return t('Finding Root Cause');
      }
      if (!hasStepType(AutofixStepType.SOLUTION)) {
        return t('Finding Solution');
      }
      if (!hasStepType(AutofixStepType.CHANGES)) {
        return t('Writing Code');
      }
    }

    if (isAutofixCompleted) {
      if (lastStep.type === AutofixStepType.ROOT_CAUSE_ANALYSIS) {
        return t('View Root Cause');
      }
      if (lastStep.type === AutofixStepType.SOLUTION) {
        return t('View Solution');
      }
      if (lastStep.type === AutofixStepType.CHANGES) {
        return t('View Code Changes');
      }
    }

    return t('Find Root Cause');
  };

  if (isButtonLoading) {
    return <ButtonPlaceholder />;
  }

  if (!showCtaButton) {
    return null;
  }

  return (
    <StyledButton
      ref={openButtonRef}
      onClick={handleOpenDrawer}
      analyticsEventKey="issue_details.seer_opened"
      analyticsEventName="Issue Details: Seer Opened"
      analyticsParams={{
        has_streamlined_ui: hasStreamlinedUI,
        autofix_exists: Boolean(autofixData?.steps?.length),
        autofix_step_type: lastStep?.type ?? null,
      }}
    >
      {getButtonText()}
      <ChevronContainer>
        {isAutofixInProgress ? (
          <StyledLoadingIndicator mini size={14} hideMessage />
        ) : (
          <Chevron direction="right" size="large" />
        )}
      </ChevronContainer>
    </StyledButton>
  );
}

const StyledButton = styled(Button)`
  margin-top: ${space(1)};
  width: 100%;
  background: ${p => p.theme.background}
    linear-gradient(to right, ${p => p.theme.background}, ${p => p.theme.pink400}20);
  color: ${p => p.theme.pink400};
`;

const ChevronContainer = styled('div')`
  margin-left: ${space(0.5)};
  height: 16px;
  width: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  position: relative;
  top: 5px;
  color: ${p => p.theme.pink400};

  .loading-indicator {
    border-color: ${p => p.theme.pink100};
    border-left-color: ${p => p.theme.pink400};
  }
`;

const ButtonPlaceholder = styled(Placeholder)`
  width: 100%;
  height: 38px;
  border-radius: ${p => p.theme.borderRadius};
  margin-top: ${space(1)};
`;
