import type {ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getActionKind,
  type ApplyBlockReason,
} from 'sentry/views/investigations/actionRequests/actionKinds';
import type {ApplyCheck} from 'sentry/views/investigations/actionRequests/applyButton';
import {
  actionRequestDryRunQueryOptions,
  type ActionRequestError,
} from 'sentry/views/investigations/api';
import {ensureSentenceEnd} from 'sentry/views/investigations/sentence';
import type {
  InvestigationAction,
  InvestigationActionRequest,
  InvestigationDetail,
} from 'sentry/views/investigations/types';

type ActionRequestDetailsProps = {
  actionRequest: InvestigationActionRequest;
  error: ActionRequestError | null;
  source?: InvestigationDetail['source'];
};

export function ActionRequestDetails({
  actionRequest,
  error,
  source,
}: ActionRequestDetailsProps) {
  const kind = getActionKind(actionRequest.action);
  if (kind?.ui.Details) {
    return (
      <kind.ui.Details
        action={kind.action}
        actionRequest={actionRequest}
        error={error}
        source={source}
      />
    );
  }
  return actionRequest.impact ? (
    <Text as="p" size="md" density="comfortable">
      {actionRequest.impact}
    </Text>
  ) : null;
}

type ActionRequestApplyProps = {
  actionRequest: InvestigationActionRequest;
  applying: boolean;
  check: ApplyCheck;
  finishing: boolean;
  onApply: () => void;
  onRecheck: () => void;
  rechecking: boolean;
};

export function ActionRequestApply({
  actionRequest,
  applying,
  check,
  finishing,
  onApply,
  onRecheck,
  rechecking,
}: ActionRequestApplyProps) {
  const kind = getActionKind(actionRequest.action);
  if (!kind) {
    return null;
  }
  return (
    <kind.ui.Apply
      action={kind.action}
      actionRequest={actionRequest}
      applying={applying}
      check={check}
      finishing={finishing}
      message={getApplyMessage(actionRequest, check, finishing)}
      onApply={onApply}
      onRecheck={onRecheck}
      rechecking={rechecking}
    />
  );
}

export function useApplyCheck(
  investigationId: string,
  actionRequest: InvestigationActionRequest
): ApplyCheck {
  const organization = useOrganization();
  const checksBeforeApply =
    getActionKind(actionRequest.action)?.ui.checksBeforeApply ?? false;
  const enabled = actionRequest.canApply && checksBeforeApply;
  const {data, isError} = useQuery({
    ...actionRequestDryRunQueryOptions(organization.slug, investigationId, actionRequest),
    enabled,
    refetchOnWindowFocus: shouldRefreshOnFocus(actionRequest) ? 'always' : false,
  });
  if (!enabled) {
    return {status: 'passed'};
  }
  if (data !== undefined) {
    return data ? {status: 'blocked', error: data} : {status: 'passed'};
  }
  if (isError) {
    return {status: 'unavailable'};
  }
  return {status: 'pending'};
}

function getApplyMessage(
  actionRequest: InvestigationActionRequest,
  check: ApplyCheck,
  finishing: boolean
) {
  if (!actionRequest.canApply) {
    return getCannotApplyMessage(actionRequest.action, actionRequest.cannotApplyReason);
  }
  if (finishing) {
    return t('Seer is finishing its suggestions…');
  }
  switch (check.status) {
    case 'blocked':
      return check.error.code === 'stale'
        ? null
        : getApplyErrorMessage(actionRequest.action, check.error);
    case 'unavailable':
      return t("Couldn't check this change in advance. Applying it checks it again.");
    default:
      return null;
  }
}

export function getAppliedSummary(
  actionRequest: InvestigationActionRequest,
  source: InvestigationDetail['source'] | undefined
): ReactNode {
  const kind = getActionKind(actionRequest.action);
  return kind
    ? kind.ui.getAppliedSummary({action: kind.action, actionRequest, source})
    : null;
}

export function getAppliedActivityTitle(
  actionRequest: InvestigationActionRequest,
  actorName: string | null,
  organizationSlug: string
): ReactNode {
  const kind = getActionKind(actionRequest.action);
  const title = kind?.ui.getActivityTitle({
    action: kind.action,
    actionRequest,
    actorName,
    organizationSlug,
  });
  if (title) {
    return title;
  }
  return actorName
    ? tct('[actor] applied “[title]”', {actor: actorName, title: actionRequest.title})
    : tct('“[title]” was applied', {title: actionRequest.title});
}

export function getAppliedActivityNote(actionRequest: InvestigationActionRequest) {
  const kind = getActionKind(actionRequest.action);
  return kind?.ui.getActivityNote?.({action: kind.action, actionRequest}) ?? null;
}

export function shouldRefreshOnFocus(actionRequest: InvestigationActionRequest) {
  return getActionKind(actionRequest.action)?.ui.refreshOnFocus?.(actionRequest) ?? false;
}

export function getApplySuccessMessage(action: InvestigationAction | null) {
  return getActionKind(action)?.ui.getSuccessMessage?.() ?? null;
}

export function getApplyErrorMessage(
  action: InvestigationAction | null,
  error: ActionRequestError
) {
  return error.code === 'validation_failed'
    ? error.messages.map(ensureSentenceEnd).join(' ')
    : getCannotApplyMessage(action, error.code);
}

export function getCannotApplyMessage(
  action: InvestigationAction | null,
  reason: ApplyBlockReason
) {
  return (
    getActionKind(action)?.ui.getCannotApplyMessage(reason) ??
    getSharedCannotApplyMessage(reason) ??
    t("This change can't be applied.")
  );
}

function getSharedCannotApplyMessage(reason: ApplyBlockReason) {
  switch (reason) {
    case 'investigation_archived':
      return t('Archived investigations are read-only.');
    case 'not_suggested':
      return t('This can no longer be applied.');
    case 'unsupported_action':
      return t("Seer can't apply this kind of change yet.");
    case 'no_access':
      return t("You don't have access to apply this.");
    case 'already_applied':
      return t('This was already applied.');
    case 'withdrawn':
      return t('Seer no longer suggests this.');
    case 'action_changed':
      return t('Seer changed this suggestion. Check the new one.');
    case 'validation_failed':
      return t("This change wasn't valid.");
    case 'not_stale':
      return t('Nothing changed since Seer suggested this.');
    case 'not_retryable':
      return t("This can't be sent to Seer again.");
    default:
      return null;
  }
}
