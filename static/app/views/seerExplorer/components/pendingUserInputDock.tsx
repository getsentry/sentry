import {Stack} from '@sentry/scraps/layout';

import type {Organization} from 'sentry/types/organization';
import type {PendingUserInputState} from 'sentry/views/seerExplorer/hooks/usePendingUserInput';
import type {
  PendingUserInput,
  RespondToUserInputOptions,
  SeerExplorerRunId,
} from 'sentry/views/seerExplorer/types';
import {getRelativeExplorerUrl} from 'sentry/views/seerExplorer/utils';

import {AgentWriteApprovalBlock} from './agentWriteApprovalBlock';
import {AskUserQuestionBlock} from './askUserQuestionBlock';
import {ConnectScmBlock} from './connectScmBlock';
import {FileChangeApprovalBlock} from './fileChangeApprovalBlock';
import {ReauthMonitoringProviderBlock} from './reauthMonitoringProviderBlock';

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
    >
      {children}
    </Stack>
  );
}

/**
 * What the run is waiting on, carrying the values its prompt needs. A run waits on one input at
 * a time.
 */
export type PendingUserInputPrompt =
  | {
      pendingInput: PendingUserInput;
      type: 'agent_write_approval' | 'connect_scm' | 'file_change_approval';
    }
  | {
      currentQuestion: NonNullable<PendingUserInputState['currentQuestion']>;
      type: 'ask_user_question';
    }
  | {
      reauthData: NonNullable<PendingUserInputState['reauthData']>;
      type: 'reauth_monitoring_provider';
    };

interface GetPendingUserInputPromptOptions {
  /** From `isReauthEnabled`. */
  canReauth: boolean;
  isAwaitingUserInput: boolean;
  pendingInput: PendingUserInput | null;
  pendingUserInputState: PendingUserInputState;
  readOnly: boolean;
}

/**
 * The prompt to show for the input the run is waiting on, or `null` when there is none. Kept
 * apart from `PendingUserInputPicker` so the chat can rank it against its other alerts.
 */
export function getPendingUserInputPrompt({
  canReauth,
  isAwaitingUserInput,
  pendingInput,
  pendingUserInputState: state,
  readOnly,
}: GetPendingUserInputPromptOptions): PendingUserInputPrompt | null {
  if (!isAwaitingUserInput || !pendingInput) {
    return null;
  }
  // Shown read-only too, so a viewer can see the run is waiting on the owner's approval.
  if (pendingInput.input_type === 'agent_write_approval') {
    return {type: 'agent_write_approval', pendingInput};
  }
  if (readOnly) {
    return null;
  }
  switch (pendingInput.input_type) {
    case 'file_change_approval':
      return state.fileApprovalIndex < state.fileApprovalTotalPatches
        ? {type: 'file_change_approval', pendingInput}
        : null;
    case 'ask_user_question':
      return state.currentQuestion
        ? {type: 'ask_user_question', currentQuestion: state.currentQuestion}
        : null;
    case 'connect_scm':
      return {type: 'connect_scm', pendingInput};
    case 'reauth_monitoring_provider':
      return canReauth && state.reauthData
        ? {type: 'reauth_monitoring_provider', reauthData: state.reauthData}
        : null;
  }
}

interface PendingUserInputPickerProps {
  /** From `usePendingUserInput`, which the composer shares for its question and diff controls. */
  pendingUserInputState: PendingUserInputState;
  prompt: PendingUserInputPrompt;
  readOnly: boolean;
  respondToUserInput: (
    inputId: string,
    responseData?: Record<string, unknown>,
    options?: RespondToUserInputOptions
  ) => void;
  runId: SeerExplorerRunId | null;
}

/** Renders the prompt from `getPendingUserInputPrompt`. */
export function PendingUserInputPicker({
  prompt,
  pendingUserInputState: state,
  readOnly,
  respondToUserInput,
  runId,
}: PendingUserInputPickerProps) {
  switch (prompt.type) {
    case 'agent_write_approval':
      return (
        <AgentWriteApprovalBlock
          key={prompt.pendingInput.id}
          pendingInput={prompt.pendingInput}
          readOnly={readOnly}
          respondToUserInput={respondToUserInput}
        />
      );
    case 'file_change_approval':
      return (
        <FileChangeApprovalBlock
          currentIndex={state.fileApprovalIndex}
          pendingInput={prompt.pendingInput}
        />
      );
    case 'ask_user_question':
      return (
        <AskUserQuestionBlock
          currentQuestion={prompt.currentQuestion}
          customText={state.customText}
          isOtherSelected={state.isOtherSelected}
          onCustomTextChange={state.handleQuestionCustomTextChange}
          onSelectOption={state.handleQuestionSelectOption}
          questionIndex={state.questionIndex}
          selectedOption={state.selectedOption}
        />
      );
    case 'connect_scm':
      return (
        <ConnectScmBlock
          key={prompt.pendingInput.id}
          pendingInput={prompt.pendingInput}
          respondToUserInput={respondToUserInput}
        />
      );
    case 'reauth_monitoring_provider':
      return (
        <ReauthMonitoringProviderBlock
          data={prompt.reauthData}
          onComplete={state.handleReauthComplete}
          returnUrl={
            runId === null ? undefined : getRelativeExplorerUrl(runId, {resume: true})
          }
        />
      );
  }
}
