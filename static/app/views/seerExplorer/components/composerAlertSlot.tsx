import {IconRefresh} from '@sentry/icons/refresh';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {SeerOutOfCreditsCta} from 'sentry/components/seer/outOfCredits/seerOutOfCreditsCta';
import {t, tct} from 'sentry/locale';
import type {SeerCreditDenialReason} from 'sentry/utils/seer/useSeerCreditCheck';

import {DraftExtras} from './emptyState';
import {
  PendingUserInputDock,
  PendingUserInputPicker,
  type PendingUserInputPrompt,
} from './pendingUserInputDock';
import {UpdateSlackAlert} from './updateSlackAlert';

/** The one alert shown above the composer. */
export type ComposerAlert =
  | {prompt: PendingUserInputPrompt; type: 'pending input'}
  | {type: 'out of credits'}
  | {type: 'autofix out of credits'}
  | {type: 'restart'}
  | {type: 'request error'}
  | {type: 'timed out'}
  | {type: 'slack upgrade'}
  | {type: 'slack reminder'};

export interface ComposerAlertState {
  /** A send failed for a reason other than credits. */
  hasRequestError: boolean;
  /** An Autofix step can't be afforded, and the chat's own check has answered. */
  isAutofixOutOfCredits: boolean;
  /** The composer is up to take a message. */
  isComposerShown: boolean;
  isOutOfCredits: boolean;
  isRestartPending: boolean;
  isTimedOut: boolean;
  /** From `getPendingUserInputPrompt`. */
  pendingUserInputPrompt: PendingUserInputPrompt | null;
  showSlackReminder: boolean;
  showSlackUpgrade: boolean;
}

/**
 * Picks the most pressing alert. A prompt the run is waiting on comes first: the approval and
 * question bars that stand in for the composer only work with it on screen.
 */
export function getComposerAlert(state: ComposerAlertState): ComposerAlert | null {
  if (state.pendingUserInputPrompt) {
    return {type: 'pending input', prompt: state.pendingUserInputPrompt};
  }
  // These are about the next message, so they only apply while the composer can take one.
  if (state.isComposerShown) {
    if (state.isOutOfCredits) {
      return {type: 'out of credits'};
    }
    if (state.isAutofixOutOfCredits) {
      return {type: 'autofix out of credits'};
    }
    if (state.isRestartPending) {
      return {type: 'restart'};
    }
  }
  if (state.hasRequestError) {
    return {type: 'request error'};
  }
  if (state.isTimedOut) {
    return {type: 'timed out'};
  }
  if (state.showSlackUpgrade) {
    return {type: 'slack upgrade'};
  }
  if (state.showSlackReminder) {
    return {type: 'slack reminder'};
  }
  return null;
}

interface ComposerAlertSlotProps {
  alert: ComposerAlert | null;
  autofixDenialReason: SeerCreditDenialReason | null;
  denialReason: SeerCreditDenialReason | null;
  hasDraft: boolean;
  onCancelRestart: () => void;
  pendingUserInput: Omit<React.ComponentProps<typeof PendingUserInputPicker>, 'prompt'>;
  slackConfigurationCount: number;
  /** Lets the Slack reminder leave after the empty state's suggestion cards. */
  slackReminderExitDelayMs: number;
  /** Omitted when the timed out message can't be retried. */
  retry?: {disabled: boolean; onRetry: () => void};
}

/** Renders the alert from `getComposerAlert` above the composer. */
export function ComposerAlertSlot({
  alert,
  pendingUserInput,
  ...props
}: ComposerAlertSlotProps) {
  if (!alert) {
    return null;
  }
  // Pending prompts are blocks shared with the transcript, which bring their own padding.
  if (alert.type === 'pending input') {
    return (
      <PendingUserInputDock>
        <PendingUserInputPicker prompt={alert.prompt} {...pendingUserInput} />
      </PendingUserInputDock>
    );
  }
  return (
    <Container padding="0 xl">
      <ComposerAlertContent alert={alert} {...props} />
    </Container>
  );
}

function ComposerAlertContent({
  alert,
  autofixDenialReason,
  denialReason,
  hasDraft,
  onCancelRestart,
  retry,
  slackConfigurationCount,
  slackReminderExitDelayMs,
}: Omit<ComposerAlertSlotProps, 'alert' | 'pendingUserInput'> & {
  alert: Exclude<ComposerAlert, {type: 'pending input'}>;
}) {
  switch (alert.type) {
    case 'out of credits':
      return (
        <Container data-test-id="seer-explorer-out-of-credits">
          <SeerOutOfCreditsCta reason="agent-chat" denialReason={denialReason} />
        </Container>
      );
    case 'autofix out of credits':
      return (
        <Container data-test-id="seer-explorer-autofix-out-of-credits">
          <SeerOutOfCreditsCta
            reason="autofix-continue"
            denialReason={autofixDenialReason}
            size="md"
          />
        </Container>
      );
    case 'restart':
      return <RestartNotice onCancel={onCancelRestart} />;
    case 'request error':
      return (
        <Alert variant="danger">
          <Text>{t('There was an error sending your message, wait and try again.')}</Text>
        </Alert>
      );
    case 'timed out':
      return (
        <Alert
          variant="warning"
          trailingItems={
            retry && (
              <Alert.Button
                variant="secondary"
                icon={<IconRefresh />}
                onClick={retry.onRetry}
                disabled={retry.disabled}
              >
                {t('Retry')}
              </Alert.Button>
            )
          }
        >
          <Text>{t('Response timed out.')}</Text>
        </Alert>
      );
    case 'slack upgrade':
      return <UpdateSlackAlert num_configurations={slackConfigurationCount} />;
    case 'slack reminder':
      return (
        <SlackAgentReminder hasDraft={hasDraft} exitDelayMs={slackReminderExitDelayMs} />
      );
  }
}

export function SlackAgentReminder({
  exitDelayMs = 0,
  hasDraft = false,
}: {
  /** Lets the reminder leave after the empty state's suggestion cards. */
  exitDelayMs?: number;
  hasDraft?: boolean;
}) {
  return (
    <DraftExtras
      $hidden={hasDraft}
      $offset={-12}
      $delay={exitDelayMs}
      aria-hidden={hasDraft || undefined}
      inert={hasDraft}
    >
      <Alert variant="muted">
        {tct('Want to chat in Slack? Just ask [mention] to debug issues.', {
          mention: (
            <Text size="md" monospace variant="promotion">
              @sentry
            </Text>
          ),
        })}
      </Alert>
    </DraftExtras>
  );
}

function RestartNotice({onCancel}: {onCancel: () => void}) {
  return (
    <Flex
      align="center"
      gap="md"
      padding="md lg"
      radius="md"
      border="accent.vibrant"
      background="secondary"
      data-test-id="seer-explorer-restart-notice"
    >
      <Stack gap="2xs" flex="1">
        <Text bold>{t('Starting over')}</Text>
        <Text variant="muted" size="sm">
          {t(
            'Seer starts a fresh analysis with your message. This conversation stays in your chat history.'
          )}
        </Text>
      </Stack>
      <Button size="xs" onClick={onCancel}>
        {t('Cancel')}
      </Button>
    </Flex>
  );
}
