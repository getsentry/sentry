import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {
  AutofixStatus,
  type AutofixStep,
  AutofixStepType,
} from 'sentry/components/events/autofix/types';
import {useAiAutofix, useAutofixData} from 'sentry/components/events/autofix/useAutofix';
import {getAutofixRunExists} from 'sentry/components/events/autofix/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import type {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';
import {useOpenSeerDrawer} from 'sentry/views/issueDetails/streamline/sidebar/seerDrawer';

interface Props {
  aiConfig: ReturnType<typeof useAiConfig>;
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
  const location = useLocation();
  const seerLink = {
    pathname: location.pathname,
    query: {
      ...location.query,
      seerDrawer: true,
    },
  };

  const openButtonRef = useRef<HTMLButtonElement>(null);
  const isDrawerOpenRef = useRef(false);

  const {isPending: isAutofixPending} = useAutofixData({groupId: group.id});
  const {autofixData} = useAiAutofix(group, event, {
    isSidebar: !isDrawerOpenRef.current,
    pollInterval: 1500,
  });

  const {openSeerDrawer} = useOpenSeerDrawer({
    group,
    project,
    event,
    buttonRef: openButtonRef,
  });

  // Keep isDrawerOpenRef in sync with the Seer drawer state (based on URL query)
  useEffect(() => {
    isDrawerOpenRef.current = !!location.query.seerDrawer;
  }, [location.query.seerDrawer]);

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
        if (currentSteps.some(step => step.type === AutofixStepType.CHANGES)) {
          addSuccessMessage(t('Seer has finished coding.'));
        } else if (currentSteps.some(step => step.type === AutofixStepType.SOLUTION)) {
          addSuccessMessage(t('Seer has found a solution.'));
        } else if (
          currentSteps.some(step => step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS)
        ) {
          addSuccessMessage(t('Seer has found the root cause.'));
        }
      }
    }

    prevStepsRef.current = autofixData?.steps ?? null;
    prevRunIdRef.current = autofixData?.run_id ?? null;
  }, [autofixData?.steps, autofixData?.run_id]);

  // Update drawer state when opening
  const handleOpenDrawer = () => {
    openSeerDrawer();
  };

  const showCtaButton =
    aiConfig.needsGenAiAcknowledgement ||
    aiConfig.hasAutofix ||
    (aiConfig.hasSummary && aiConfig.hasResources);
  const isButtonLoading =
    aiConfig.isAutofixSetupLoading || (isAutofixPending && getAutofixRunExists(group));

  const lastStep = autofixData?.steps?.[autofixData.steps.length - 1];
  const isAutofixInProgress = lastStep?.status === AutofixStatus.PROCESSING;
  const isAutofixCompleted = lastStep?.status === AutofixStatus.COMPLETED;
  const isAutofixWaitingForUser =
    autofixData?.status === AutofixStatus.WAITING_FOR_USER_RESPONSE;

  const hasStepType = (type: AutofixStepType) =>
    autofixData?.steps?.some(step => step.type === type);

  const getButtonText = () => {
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
      to={seerLink}
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
          <StyledLoadingIndicator size={14} />
        ) : (
          <IconChevron direction="right" size="xs" />
        )}
      </ChevronContainer>
    </StyledButton>
  );
}

const StyledButton = styled(LinkButton)`
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
  margin-left: ${space(1)};
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
