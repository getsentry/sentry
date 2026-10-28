import {Fragment} from 'react';
import {IconSiren} from '@sentry/icons/siren';
import {z} from 'zod';

import {LinkButton} from '@sentry/scraps/button';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';
import type {
  ActionKindApplyProps,
  ActionKindDetailsProps,
  ActionKindUI,
} from 'sentry/views/investigations/actionRequests/actionKinds';
import {ApplyButton} from 'sentry/views/investigations/actionRequests/applyButton';
import {MonitorChanges} from 'sentry/views/investigations/actionRequests/monitorChanges';
import {getSourceMonitor, type SourceMonitor} from 'sentry/views/investigations/source';
import type {
  InvestigationActionRequest,
  InvestigationUpdateDetectorAction,
} from 'sentry/views/investigations/types';

export const updateDetectorUI: ActionKindUI<InvestigationUpdateDetectorAction> = {
  Details: UpdateDetectorDetails,
  Apply: UpdateDetectorApply,
  checksBeforeApply: true,
  getAppliedSummary: ({action, actionRequest, source}) => (
    <Fragment>
      <Text bold>{t('Monitor updated.')}</Text>{' '}
      {t(
        '%s was changed to the settings below.',
        getMonitorName(actionRequest, getSourceMonitor(source, action.detectorId)) ??
          t('The monitor')
      )}
    </Fragment>
  ),
  getCannotApplyMessage: reason => {
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
  },
  getSuccessMessage: () => t('Monitor updated.'),
};

function UpdateDetectorDetails({
  action,
  actionRequest,
  source,
}: ActionKindDetailsProps<InvestigationUpdateDetectorAction>) {
  const monitor = getSourceMonitor(source, action.detectorId);
  return (
    <MonitorChanges
      action={action}
      applied={actionRequest.state === 'applied'}
      impact={actionRequest.impact}
      monitor={monitor}
      name={getMonitorName(actionRequest, monitor)}
    />
  );
}

function UpdateDetectorApply({
  action,
  actionRequest,
  applying,
  check,
  message,
  onApply,
}: ActionKindApplyProps<InvestigationUpdateDetectorAction>) {
  const organization = useOrganization();
  switch (actionRequest.state) {
    case 'suggested':
      return (
        <ApplyButton
          canApply={actionRequest.canApply}
          applying={applying}
          check={check}
          message={message}
          onApply={onApply}
          icon={<IconSiren />}
          label={t('Update monitor')}
          busyLabel={t('Updating monitor…')}
        />
      );
    case 'applied':
      return (
        <LinkButton
          variant="primary"
          icon={<IconSiren />}
          to={makeMonitorDetailsPathname(organization.slug, action.detectorId)}
        >
          {t('View monitor')}
        </LinkButton>
      );
    default:
      return null;
  }
}

const appliedDetailsSchema = z.object({detectorName: z.string()});

function getMonitorName(
  actionRequest: InvestigationActionRequest,
  monitor: SourceMonitor | null
) {
  return (
    appliedDetailsSchema.safeParse(actionRequest.appliedDetails).data?.detectorName ??
    monitor?.name ??
    null
  );
}
