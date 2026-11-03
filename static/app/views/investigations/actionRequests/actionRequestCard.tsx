import {useEffect, useId, useRef} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {TimeSince} from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import {isSeerExplorerEnabled} from 'sentry/utils/seer/isSeerExplorerEnabled';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {
  ActionRequestApply,
  ActionRequestDetails,
  getAppliedSummary,
  getApplyErrorMessage,
  getApplySuccessMessage,
  getCannotApplyMessage,
  useApplyCheck,
} from 'sentry/views/investigations/actionRequests/actionRequestDetails';
import type {ApplyCheck} from 'sentry/views/investigations/actionRequests/applyButton';
import {
  canRetryFollowUp,
  isFollowUpPending,
  parseApplyError,
  useInvestigationActionRequestMutation,
  type ActionRequestError,
  type ActionRequestFollowUp,
} from 'sentry/views/investigations/api';
import {ensureSentenceEnd} from 'sentry/views/investigations/sentence';
import type {
  InvestigationActionRequest,
  InvestigationDetail,
} from 'sentry/views/investigations/types';
import {getActorName} from 'sentry/views/investigations/utils';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';

const CURRENT_STATES = new Set<InvestigationActionRequest['state']>([
  'suggested',
  'applied',
]);

type ActionRequestCardProps = {
  actionRequest: InvestigationActionRequest;
  investigationId: string;
  finishing?: boolean;
  heading?: string;
  label?: React.ReactNode;
  runProcessing?: boolean;
  source?: InvestigationDetail['source'];
};

export function ActionRequestCard({
  actionRequest,
  finishing = false,
  heading,
  investigationId,
  label,
  runProcessing = false,
  source,
}: ActionRequestCardProps) {
  const headingId = useId();
  const organization = useOrganization();
  const check = useApplyCheck(investigationId, actionRequest);
  const applyMutation = useInvestigationActionRequestMutation(
    organization.slug,
    investigationId,
    'apply',
    {
      onSuccess: (_response, applied) => {
        const message = getApplySuccessMessage(applied.action);
        if (message) {
          toast.success(message);
        }
      },
      onError: (error, applied) => {
        const applyError = parseApplyError(error);
        if (applyError?.code === 'validation_failed') {
          return;
        }
        toast.error(
          applyError
            ? getCannotApplyMessage(applied.action, applyError.code)
            : t('Unable to apply this change.')
        );
      },
    }
  );

  const recheckMutation = useInvestigationActionRequestMutation(
    organization.slug,
    investigationId,
    'recheck',
    {
      onError: (error, rechecked) => {
        const recheckError = parseApplyError(error);
        if (recheckError?.code === 'not_stale') {
          toast.message(getCannotApplyMessage(rechecked.action, recheckError.code));
          return;
        }
        toast.error(
          recheckError
            ? getCannotApplyMessage(rechecked.action, recheckError.code)
            : t('Unable to recheck this suggestion.')
        );
      },
    }
  );

  const retryFollowUpMutation = useInvestigationActionRequestMutation(
    organization.slug,
    investigationId,
    'retry-follow-up',
    {
      onError: (error, retried) => {
        const retryError = parseApplyError(error);
        toast.error(
          retryError
            ? getCannotApplyMessage(retried.action, retryError.code)
            : t('Unable to send this to Seer again.')
        );
      },
    }
  );

  const previousCheckStatus = useRef(check.status);
  const {error: applyMutationError, reset: resetApplyMutation} = applyMutation;
  useEffect(() => {
    if (
      check.status === 'passed' &&
      previousCheckStatus.current !== 'passed' &&
      applyMutationError
    ) {
      resetApplyMutation();
    }
    previousCheckStatus.current = check.status;
  }, [check.status, applyMutationError, resetApplyMutation]);

  if (!isShownActionRequest(actionRequest)) {
    return null;
  }

  const labelProps = heading
    ? {'aria-labelledby': headingId}
    : {'aria-label': actionRequest.title};
  const headingElement = heading ? (
    <Heading as="h2" size="lg" id={headingId}>
      {heading}
    </Heading>
  ) : null;
  const labelElement = label ? (
    <Text as="p" size="sm" variant="muted">
      {label}
    </Text>
  ) : null;

  if (actionRequest.state === 'withdrawn') {
    return (
      <Stack as="section" gap="md" {...labelProps}>
        {headingElement}
        {labelElement}
        <Text as="p" size="md" density="comfortable" variant="muted">
          {actionRequest.reason
            ? tct('Seer no longer recommends “[title]”: [reason]', {
                title: actionRequest.title,
                reason: actionRequest.reason,
              })
            : tct('Seer no longer recommends “[title]”.', {title: actionRequest.title})}
        </Text>
      </Stack>
    );
  }

  const applying =
    applyMutation.isPending && applyMutation.variables?.id === actionRequest.id;
  const applyError =
    applyMutation.variables?.id === actionRequest.id
      ? parseApplyError(applyMutation.error)
      : null;
  const staleError = getStaleError(actionRequest, check, applyError);
  const rechecking =
    recheckMutation.isPending && recheckMutation.variables?.id === actionRequest.id;
  const retryingFollowUp =
    retryFollowUpMutation.isPending &&
    retryFollowUpMutation.variables?.id === actionRequest.id;
  const appliedSummary =
    actionRequest.state === 'applied' ? getAppliedSummary(actionRequest, source) : null;

  return (
    <Stack as="section" gap="lg" {...labelProps}>
      {headingElement}
      {labelElement}
      <Stack gap="xs">
        <Text as="p" size="md" density="comfortable">
          {appliedSummary ??
            tct('[title] [rationale]', {
              title: <Text bold>{ensureSentenceEnd(actionRequest.title)}</Text>,
              rationale: actionRequest.rationale,
            })}
        </Text>
        {actionRequest.state === 'applied' ? (
          <AppliedBy actionRequest={actionRequest} />
        ) : null}
      </Stack>
      {canRetryFollowUp(actionRequest) ? (
        <Flex>
          <TryAgainButton
            busy={retryingFollowUp}
            onClick={() => retryFollowUpMutation.mutate(actionRequest)}
          />
        </Flex>
      ) : null}
      {staleError ? (
        <Alert.Container>
          <Alert
            variant="warning"
            role="status"
            trailingItems={
              actionRequest.followUp?.status === 'failed' ? (
                <TryAgainButton
                  busy={rechecking}
                  onClick={() => recheckMutation.mutate(actionRequest)}
                />
              ) : undefined
            }
          >
            <StaleSuggestionMessage
              actionRequest={actionRequest}
              message={getApplyErrorMessage(actionRequest.action, staleError)}
              runProcessing={runProcessing}
            />
          </Alert>
        </Alert.Container>
      ) : null}
      <ActionRequestDetails
        actionRequest={actionRequest}
        error={staleError}
        source={source}
      />
      {applyError?.code === 'validation_failed' ? (
        <Alert.Container>
          <Alert variant="danger" role="alert">
            {t(
              'This change could not be applied. %s',
              getApplyErrorMessage(actionRequest.action, applyError)
            )}
          </Alert>
        </Alert.Container>
      ) : null}
      <ActionRequestApply
        actionRequest={actionRequest}
        applying={applying}
        check={check}
        finishing={finishing}
        onApply={() => applyMutation.mutate(actionRequest)}
        onRecheck={() => recheckMutation.mutate(actionRequest)}
        rechecking={rechecking}
      />
    </Stack>
  );
}

function TryAgainButton({busy, onClick}: {busy: boolean; onClick: () => void}) {
  return (
    <Button size="xs" busy={busy} disabled={busy} onClick={onClick}>
      {t('Try again')}
    </Button>
  );
}

function AppliedBy({actionRequest}: {actionRequest: InvestigationActionRequest}) {
  const user = useUser();
  const {appliedBy, dateApplied} = actionRequest;
  const time = dateApplied ? <TimeSince date={dateApplied} /> : null;
  if (!appliedBy) {
    return (
      <Text as="p" size="sm" variant="muted">
        {time ? tct('Applied [time]', {time}) : t('Applied')}
      </Text>
    );
  }
  const name = appliedBy.id === user.id ? t('you') : getActorName(appliedBy);
  return (
    <Text as="p" size="sm" variant="muted">
      {time
        ? tct('Applied by [name] • [time]', {name, time})
        : tct('Applied by [name]', {name})}
    </Text>
  );
}

function isShownActionRequest(actionRequest: InvestigationActionRequest) {
  return (
    isCurrentActionRequest(actionRequest) ||
    actionRequest.state === 'withdrawn' ||
    isStaleActionRequest(actionRequest)
  );
}

export function isCurrentActionRequest(actionRequest: InvestigationActionRequest) {
  return CURRENT_STATES.has(actionRequest.state);
}

export function isStaleActionRequest(actionRequest: InvestigationActionRequest) {
  return actionRequest.state === 'superseded' && actionRequest.error?.code === 'stale';
}

function getStaleError(
  actionRequest: InvestigationActionRequest,
  check: ApplyCheck,
  applyError: ActionRequestError | null
) {
  if (actionRequest.error?.code === 'stale') {
    return actionRequest.error;
  }
  if (applyError?.code === 'stale') {
    return applyError;
  }
  if (check.status === 'blocked' && check.error.code === 'stale') {
    return check.error;
  }
  return null;
}

function StaleSuggestionMessage({
  actionRequest,
  message,
  runProcessing,
}: {
  actionRequest: InvestigationActionRequest;
  message: string;
  runProcessing: boolean;
}) {
  const organization = useOrganization();
  const {openSeerExplorer} = useSeerExplorerContext();
  const {followUp} = actionRequest;
  if (isFollowUpPending(actionRequest)) {
    return tct('[message] Seer is checking the suggestion again…', {message});
  }
  if (followUp?.status === 'acknowledged' && runProcessing) {
    return tct('[message] Seer is updating its suggestion…', {message});
  }
  const notice =
    followUp?.status === 'failed' ? getRecheckFailedNotice(message, followUp) : message;
  if (!isSeerExplorerEnabled(organization)) {
    return tct('[message] Ask Seer about this investigation for a new suggestion.', {
      message: notice,
    });
  }
  return tct('[message] [ask:Ask Seer about this investigation] for a new suggestion.', {
    message: notice,
    ask: (
      <Button variant="link" size="zero" onClick={() => openSeerExplorer()}>
        {null}
      </Button>
    ),
  });
}

function getRecheckFailedNotice(message: string, followUp: ActionRequestFollowUp) {
  return followUp.reason === 'action_requests_report_changed'
    ? t("%s Seer couldn't check it again because the report changed.", message)
    : t("%s Seer couldn't check it again.", message);
}
