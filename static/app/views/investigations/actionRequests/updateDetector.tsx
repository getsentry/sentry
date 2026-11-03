import {Fragment} from 'react';
import {IconSiren} from '@sentry/icons/siren';
import {z} from 'zod';

import {LinkButton} from '@sentry/scraps/button';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import {oxfordizeArray} from 'sentry/utils/oxfordizeArray';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';
import type {
  ActionKindApplyProps,
  ActionKindDetailsProps,
  ActionKindUI,
} from 'sentry/views/investigations/actionRequests/actionKinds';
import {ApplyButton} from 'sentry/views/investigations/actionRequests/applyButton';
import {
  getChangedFieldLabels,
  MonitorChanges,
} from 'sentry/views/investigations/actionRequests/monitorChanges';
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
  getActivityTitle: ({actionRequest, actorName, organizationSlug}) => {
    const details = getAppliedDetails(actionRequest);
    if (!details) {
      return null;
    }
    const fields = oxfordizeArray(getChangedFieldLabels(details.fields));
    const monitor = (
      <Link to={makeMonitorDetailsPathname(organizationSlug, details.detectorId)}>
        {details.detectorName}
      </Link>
    );
    if (!fields) {
      return actorName
        ? tct('[actor] updated [monitor]', {actor: actorName, monitor})
        : tct('[monitor] was updated', {monitor});
    }
    return actorName
      ? tct('[actor] updated the [fields] for [monitor]', {
          actor: actorName,
          fields,
          monitor,
        })
      : tct('The [fields] for [monitor] changed', {fields, monitor});
  },
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
  error,
  source,
}: ActionKindDetailsProps<InvestigationUpdateDetectorAction>) {
  const monitor = getSourceMonitor(source, action.detectorId);
  return (
    <MonitorChanges
      action={action}
      applied={actionRequest.state === 'applied'}
      current={error?.code === 'stale' ? error.current : undefined}
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
  finishing,
  message,
  onApply,
  onRecheck,
  rechecking,
}: ActionKindApplyProps<InvestigationUpdateDetectorAction>) {
  const organization = useOrganization();
  switch (actionRequest.state) {
    case 'suggested':
      return (
        <ApplyButton
          canApply={actionRequest.canApply}
          applying={applying}
          check={check}
          disabled={finishing}
          message={message}
          onApply={onApply}
          onRecheck={onRecheck}
          rechecking={rechecking}
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

const appliedDetailsSchema = z.object({
  detectorId: z.string(),
  detectorName: z.string(),
  fields: z.array(z.string()),
});

function getAppliedDetails(actionRequest: InvestigationActionRequest) {
  return appliedDetailsSchema.safeParse(actionRequest.appliedDetails).data ?? null;
}

function getMonitorName(
  actionRequest: InvestigationActionRequest,
  monitor: SourceMonitor | null
) {
  return getAppliedDetails(actionRequest)?.detectorName ?? monitor?.name ?? null;
}
