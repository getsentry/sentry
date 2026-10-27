import type {ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
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
  source?: InvestigationDetail['source'];
};

export function ActionRequestDetails({actionRequest, source}: ActionRequestDetailsProps) {
  const kind = getActionKind(actionRequest.action);
  if (kind?.ui.Details) {
    return (
      <kind.ui.Details
        action={kind.action}
        actionRequest={actionRequest}
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
  onApply: () => void;
};

export function ActionRequestApply({
  actionRequest,
  applying,
  check,
  onApply,
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
      message={getApplyMessage(actionRequest, check)}
      onApply={onApply}
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
  const {data, isError, isPending} = useQuery({
    ...actionRequestDryRunQueryOptions(organization.slug, investigationId, actionRequest),
    enabled,
  });
  if (!enabled) {
    return {status: 'passed'};
  }
  if (isError) {
    return {status: 'unavailable'};
  }
  if (isPending) {
    return {status: 'pending'};
  }
  return data ? {status: 'blocked', error: data} : {status: 'passed'};
}

function getApplyMessage(actionRequest: InvestigationActionRequest, check: ApplyCheck) {
  if (!actionRequest.canApply) {
    return getCannotApplyMessage(actionRequest.action, actionRequest.cannotApplyReason);
  }
  switch (check.status) {
    case 'blocked':
      return getApplyErrorMessage(actionRequest.action, check.error);
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
    default:
      return null;
  }
}
