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
import {actionRequestDryRunQueryOptions} from 'sentry/views/investigations/api';
import {getSourceMonitor} from 'sentry/views/investigations/source';
import type {
  InvestigationAction,
  InvestigationActionApplyErrorCode,
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
          actionRequest={actionRequest}
          applying={applying}
          check={check}
          onApply={onApply}
          icon={<IconSiren />}
          label={t('Update monitor')}
          busyLabel={t('Updating monitor…')}
          getCannotApplyMessage={reason =>
            getCannotApplyMessage(actionRequest.action, reason)
          }
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
    enabled: hasApplyCheck(actionRequest) && actionRequest.canApply,
  });
  if (isError) {
    return {status: 'unavailable'};
  }
  if (isPending) {
    return {status: 'pending'};
  }
  return data ? {status: 'blocked', error: data} : {status: 'passed'};
}

function hasApplyCheck(actionRequest: InvestigationActionRequest) {
  switch (actionRequest.action?.kind) {
    case 'update_detector':
      return true;
    default:
      return false;
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
  reason: InvestigationActionApplyErrorCode
) {
  return getKindCannotApplyMessage(action, reason) ?? getSharedCannotApplyMessage(reason);
}

function getKindCannotApplyMessage(
  action: InvestigationAction | null,
  reason: InvestigationActionApplyErrorCode
) {
  switch (action?.kind) {
    case 'update_detector':
      return getMonitorCannotApplyMessage(reason);
    default:
      return null;
  }
}

function getSharedCannotApplyMessage(reason: InvestigationActionApplyErrorCode) {
  switch (reason) {
    case 'investigation_archived':
      return t('Archived investigations are read-only.');
    case 'not_suggested':
      return t('This can no longer be applied.');
    case 'unsupported_action':
      return t("Seer can't apply this kind of change yet.");
    case 'no_access':
      return t("You don't have access to apply this.");
    default:
      return null;
  }
}

function getMonitorCannotApplyMessage(reason: InvestigationActionApplyErrorCode) {
  switch (reason) {
    case 'permission_denied':
      return t("You don't have permission to edit this monitor.");
    case 'detector_not_found':
      return t('This monitor is no longer available.');
    case 'not_target_detector':
      return t('This change targets a different monitor than this investigation.');
    default:
      return null;
  }
}
