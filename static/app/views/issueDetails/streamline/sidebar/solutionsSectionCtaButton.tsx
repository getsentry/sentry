import {useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {Chevron} from 'sentry/components/chevron';
import {AutofixStatus, AutofixStepType} from 'sentry/components/events/autofix/types';
import {useAiAutofix} from 'sentry/components/events/autofix/useAutofix';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useOpenSolutionsDrawer} from 'sentry/views/issueDetails/streamline/sidebar/solutionsHubDrawer';

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

export function SolutionsSectionCtaButton({
  aiConfig,
  event,
  group,
  project,
  hasStreamlinedUI,
}: Props) {
  const openButtonRef = useRef<HTMLButtonElement>(null);

  const {autofixData} = useAiAutofix(group, event);

  const openSolutionsDrawer = useOpenSolutionsDrawer(
    group,
    project,
    event,
    openButtonRef
  );

  const showCtaButton =
    aiConfig.needsGenAIConsent ||
    aiConfig.hasAutofix ||
    (aiConfig.hasSummary && aiConfig.hasResources);
  const isButtonLoading = aiConfig.isAutofixSetupLoading;

  const lastStep = autofixData?.steps?.[autofixData.steps.length - 1];
  const isAutofixInProgress = lastStep?.status === AutofixStatus.PROCESSING;
  const isAutofixCompleted = lastStep?.status === AutofixStatus.COMPLETED;
  const isAutofixWaitingForUser =
    autofixData?.status === AutofixStatus.WAITING_FOR_USER_RESPONSE;

  const hasStepType = (type: AutofixStepType) =>
    autofixData?.steps?.some(step => step.type === type);

  const getButtonText = () => {
    if (aiConfig.needsGenAIConsent) {
      return t('Set Up Seer');
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
      onClick={() => openSolutionsDrawer()}
      analyticsEventKey="issue_details.solutions_hub_opened"
      analyticsEventName="Issue Details: Solutions Hub Opened"
      analyticsParams={{
        has_streamlined_ui: hasStreamlinedUI,
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
