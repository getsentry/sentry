import {IconSiren} from '@sentry/icons/siren';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ApplyButton} from 'sentry/views/investigations/actionRequests/applyButton';
import {MonitorChanges} from 'sentry/views/investigations/actionRequests/monitorChanges';
import {
  actionRequestDryRunQueryOptions,
  getInvestigationDetailQueryOptions,
  parseApplyError,
  type ApplyError,
} from 'sentry/views/investigations/api';
import {getSourceMonitor} from 'sentry/views/investigations/source';
import type {
  InvestigationAction,
  InvestigationActionCannotApplyReason,
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
  check: ApplyError | null;
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
          cannotApplyMessage={getMonitorCannotApplyMessage(
            actionRequest.cannotApplyReason
          )}
        />
      );
    default:
      return null;
  }
}

export function useApplyCheck(
  investigationId: string,
  actionRequest: InvestigationActionRequest
): ApplyError | null {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const investigationVersion = queryClient.getQueryData(
    getInvestigationDetailQueryOptions(organization.slug, investigationId).queryKey
  )?.json.version;
  const {error} = useQuery({
    ...actionRequestDryRunQueryOptions(
      organization.slug,
      investigationId,
      actionRequest.id,
      investigationVersion
    ),
    enabled:
      hasApplyCheck(actionRequest) &&
      actionRequest.state === 'suggested' &&
      actionRequest.canApply,
  });
  return error ? parseApplyError(error) : null;
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

function getMonitorCannotApplyMessage(
  reason: InvestigationActionCannotApplyReason | null
) {
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
