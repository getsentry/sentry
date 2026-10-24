import {IconSiren} from '@sentry/icons/siren';

import {t} from 'sentry/locale';
import type {
  ActionKindApplyProps,
  ActionKindDetailsProps,
  ActionKindUI,
} from 'sentry/views/investigations/actionRequests/actionKinds';
import {ApplyButton} from 'sentry/views/investigations/actionRequests/applyButton';
import {MonitorChanges} from 'sentry/views/investigations/actionRequests/monitorChanges';
import {getSourceMonitor} from 'sentry/views/investigations/source';
import type {InvestigationUpdateDetectorAction} from 'sentry/views/investigations/types';

export const updateDetectorUI: ActionKindUI<InvestigationUpdateDetectorAction> = {
  Details: UpdateDetectorDetails,
  Apply: UpdateDetectorApply,
  checksBeforeApply: true,
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
  return (
    <MonitorChanges
      action={action}
      impact={actionRequest.impact}
      monitor={getSourceMonitor(source, action.detectorId)}
    />
  );
}

function UpdateDetectorApply({
  actionRequest,
  applying,
  check,
  message,
  onApply,
}: ActionKindApplyProps<InvestigationUpdateDetectorAction>) {
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
}
