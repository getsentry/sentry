import {css} from '@emotion/react';

import {Stack} from '@sentry/scraps/layout';

import type {Organization} from 'sentry/types/organization';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AgentWriteApprovalBlock} from 'sentry/views/seerExplorer/components/agentWriteApprovalBlock';
import {AskUserQuestionBlock} from 'sentry/views/seerExplorer/components/askUserQuestionBlock';
import {FileChangeApprovalBlock} from 'sentry/views/seerExplorer/components/fileChangeApprovalBlock';
import {ReauthMonitoringProviderBlock} from 'sentry/views/seerExplorer/components/reauthMonitoringProviderBlock';
import type {PendingUserInputState} from 'sentry/views/seerExplorer/hooks/usePendingUserInput';
import type {
  PendingUserInput,
  RespondToUserInputOptions,
  SeerExplorerRunId,
} from 'sentry/views/seerExplorer/types';
import {getRelativeExplorerUrl} from 'sentry/views/seerExplorer/utils';

/** Whether this organization can be asked to reconnect a monitoring provider. */
export function isReauthEnabled(organization: Organization | null) {
  return (
    !!organization?.features.includes('seer-infra-telemetry') &&
    !!organization?.features.includes('seer-infra-telemetry-user-level-auth')
  );
}

/**
 * Pins the prompt for whatever the run is waiting on between the transcript and the composer,
 * so scrolling back through the conversation never hides it.
 */
export function PendingUserInputDock({children}: {children: React.ReactNode}) {
  return (
    <Stack
      data-test-id="seer-explorer-pending-input"
      flexShrink={0}
      maxHeight="50%"
      overflowY="auto"
      gap="md"
      paddingTop="md"
      // Takes no space when there is no prompt to show.
      css={css`
        &:empty {
          display: none;
        }
      `}
    >
      {children}
    </Stack>
  );
}

interface PendingUserInputPickerProps {
  isAwaitingUserInput: boolean;
  pendingInput: PendingUserInput | null;
  /** From `usePendingUserInput`, which the composer shares for its question and diff controls. */
  pendingUserInputState: PendingUserInputState;
  readOnly: boolean;
  respondToUserInput: (
    inputId: string,
    responseData?: Record<string, unknown>,
    options?: RespondToUserInputOptions
  ) => void;
  runId: SeerExplorerRunId | null;
}

/** The prompt for the input the run is waiting on. A run waits on one input at a time. */
export function PendingUserInputPicker({
  isAwaitingUserInput,
  pendingInput,
  pendingUserInputState: state,
  readOnly,
  respondToUserInput,
  runId,
}: PendingUserInputPickerProps) {
  const organization = useOrganization({allowNull: true});

  if (!isAwaitingUserInput || !pendingInput) {
    return null;
  }

  // Shown read-only too, so a viewer can see the run is waiting on the owner's approval.
  if (pendingInput.input_type === 'agent_write_approval') {
    return (
      <AgentWriteApprovalBlock
        key={pendingInput.id}
        pendingInput={pendingInput}
        readOnly={readOnly}
        respondToUserInput={respondToUserInput}
      />
    );
  }

  if (readOnly) {
    return null;
  }

  if (
    pendingInput.input_type === 'file_change_approval' &&
    state.fileApprovalIndex < state.fileApprovalTotalPatches
  ) {
    return (
      <FileChangeApprovalBlock
        currentIndex={state.fileApprovalIndex}
        pendingInput={pendingInput}
      />
    );
  }

  if (pendingInput.input_type === 'ask_user_question' && state.currentQuestion) {
    return (
      <AskUserQuestionBlock
        currentQuestion={state.currentQuestion}
        customText={state.customText}
        isOtherSelected={state.isOtherSelected}
        onCustomTextChange={state.handleQuestionCustomTextChange}
        onSelectOption={state.handleQuestionSelectOption}
        questionIndex={state.questionIndex}
        selectedOption={state.selectedOption}
      />
    );
  }

  if (
    pendingInput.input_type === 'reauth_monitoring_provider' &&
    isReauthEnabled(organization) &&
    state.reauthData
  ) {
    return (
      <ReauthMonitoringProviderBlock
        data={state.reauthData}
        onComplete={state.handleReauthComplete}
        returnUrl={
          runId === null ? undefined : getRelativeExplorerUrl(runId, {resume: true})
        }
      />
    );
  }

  return null;
}
