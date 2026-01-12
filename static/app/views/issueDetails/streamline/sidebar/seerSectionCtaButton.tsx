import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import color from 'color';

import {Flex} from '@sentry/scraps/layout';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {
  AutofixStatus,
  AutofixStepType,
  type AutofixStep,
} from 'sentry/components/events/autofix/types';
import {useAiAutofix, useAutofixData} from 'sentry/components/events/autofix/useAutofix';
import {
  getAutofixRunExists,
  getCodeChangesDescription,
  getRootCauseDescription,
  getSolutionDescription,
  hasPullRequest,
} from 'sentry/components/events/autofix/utils';
import {useGroupSummaryData} from 'sentry/components/group/groupSummary';
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

  const {data: summaryData, isPending: isSummaryPending} = useGroupSummaryData(group);

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
    aiConfig.orgNeedsGenAiAcknowledgement ||
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

  const rootCauseDescription = autofixData ? getRootCauseDescription(autofixData) : null;
  const solutionDescription = autofixData ? getSolutionDescription(autofixData) : null;
  const codeChangesDescription = autofixData
    ? getCodeChangesDescription(autofixData)
    : null;
  const hasPr = hasPullRequest(autofixData);

  const getButtonText = () => {
    if (!aiConfig.hasAutofix) {
      return t('Open Resources');
    }

    if (
      (aiConfig.orgNeedsGenAiAcknowledgement || !aiConfig.hasAutofixQuota) &&
      !aiConfig.isAutofixSetupLoading
    ) {
      return t('Fix with Seer');
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
      if (lastStep.type === AutofixStepType.SOLUTION) {
        return t('Fix with Seer');
      }
      return t('Open Seer');
    }

    return t('Fix with Seer');
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
      replace
      preventScrollReset
      analyticsEventKey="issue_details.seer_opened"
      analyticsEventName="Issue Details: Seer Opened"
      analyticsParams={{
        has_streamlined_ui: hasStreamlinedUI,
        autofix_exists: Boolean(autofixData?.steps?.length),
        autofix_step_type: lastStep?.type ?? null,
        has_summary: Boolean(summaryData && !isSummaryPending),
        has_root_cause: Boolean(rootCauseDescription),
        has_solution: Boolean(solutionDescription),
        has_coded_solution: Boolean(codeChangesDescription),
        has_pr: hasPr,
      }}
      priority="primary"
    >
      {getButtonText()}
      <Flex justify="center" align="center" marginLeft="xs" width="16px" height="16px">
        {isAutofixInProgress ? (
          <StyledLoadingIndicator size={14} />
        ) : (
          <IconChevron direction="right" size="xs" />
        )}
      </Flex>
    </StyledButton>
  );
}

const StyledButton = styled(LinkButton)`
  margin-top: ${space(1)};
  width: 100%;
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  position: relative;
  margin-left: ${space(1)};

  .loading-indicator {
    border-color: ${p => color(p.theme.button.primary.color).alpha(0.35).string()};
    border-left-color: ${p => p.theme.button.primary.color};
  }
`;

const ButtonPlaceholder = styled(Placeholder)`
  width: 100%;
  height: 38px;
  border-radius: ${p => p.theme.radius.md};
  margin-top: ${space(1)};
`;
