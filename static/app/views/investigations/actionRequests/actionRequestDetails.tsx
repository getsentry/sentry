import {IconSiren} from '@sentry/icons/siren';
import {useQuery} from '@tanstack/react-query';

import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  ApplyButton,
  type ApplyCheck,
} from 'sentry/views/investigations/actionRequests/applyButton';
import {MonitorChanges} from 'sentry/views/investigations/actionRequests/monitorChanges';
import {
  actionRequestDryRunQueryOptions,
  type ActionRequestError,
} from 'sentry/views/investigations/api';
import {getSourceMonitor} from 'sentry/views/investigations/source';
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
  const {action, impact} = actionRequest;

  switch (action?.kind) {
    case 'update_detector':
      return (
        <MonitorChanges
          action={action}
          impact={impact}
          monitor={getSourceMonitor(source, action.detectorId)}
        />
      );
    default:
      return impact ? (
        <Text as="p" size="md" density="comfortable">
          {impact}
        </Text>
      ) : null;
  }
}

type ApplyBlockReason =
  | InvestigationActionRequest['cannotApplyReason']
  | ActionRequestError['code'];

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
  switch (actionRequest.action?.kind) {
    case 'update_detector':
      return (
        <ApplyButton
          canApply={actionRequest.canApply}
          applying={applying}
          check={check}
          message={getApplyMessage(actionRequest, check)}
          onApply={onApply}
          icon={<IconSiren />}
          label={t('Update monitor')}
          busyLabel={t('Updating monitor…')}
        />
      );
    default:
      return null;
  }
}

export function useApplyCheck(
  investigationId: string,
  actionRequest: InvestigationActionRequest
): ApplyCheck {
  const organization = useOrganization();
  const {data, isError, isPending} = useQuery({
    ...actionRequestDryRunQueryOptions(organization.slug, investigationId, actionRequest),
    enabled: actionRequest.canApply,
  });
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
      return getCannotApplyMessage(actionRequest.action, check.error.code);
    case 'unavailable':
      return t("Couldn't check this change in advance. Applying it checks it again.");
    default:
      return null;
  }
}

export function getApplySuccessMessage(action: InvestigationAction | null) {
  switch (action?.kind) {
    case 'update_detector':
      return t('Monitor updated.');
    default:
      return null;
  }
}

export function getCannotApplyMessage(
  action: InvestigationAction | null,
  reason: ApplyBlockReason
) {
  return (
    getKindCannotApplyMessage(action, reason) ??
    getSharedCannotApplyMessage(reason) ??
    t("This change can't be applied.")
  );
}

function getKindCannotApplyMessage(
  action: InvestigationAction | null,
  reason: ApplyBlockReason
) {
  switch (action?.kind) {
    case 'update_detector':
      return getMonitorCannotApplyMessage(reason);
    default:
      return null;
  }
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
    case 'stale':
      return t('This changed since Seer suggested it.');
    case 'validation_failed':
      return t("This change wasn't valid.");
    default:
      return null;
  }
}

function getMonitorCannotApplyMessage(reason: ApplyBlockReason) {
  switch (reason) {
    case 'permission_denied':
      return t("You don't have permission to edit this monitor.");
    case 'detector_not_found':
      return t('This monitor is no longer available.');
    case 'not_target_detector':
      return t('This change targets a different monitor than this investigation.');
    case 'dynamic_detector':
      return t("Seer can't change dynamic monitors yet.");
    case 'stale':
      return t('The monitor changed since Seer suggested this.');
    default:
      return null;
  }
}
