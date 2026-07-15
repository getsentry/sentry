import {Fragment} from 'react';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  DisableDetectorAction,
  EditDetectorAction,
} from 'sentry/views/detectors/components/details/common/actions';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {
  makeMonitorBasePathname,
  makeMonitorTypePathname,
} from 'sentry/views/detectors/pathnames';
import {getDetectorTypeLabel} from 'sentry/views/detectors/utils/detectorTypeConfig';
import {TopBar} from 'sentry/views/navigation/topBar';

type DetectorDetailsHeaderProps = {
  detector: Detector;
  useLocalDetailActions?: boolean;
};

function DetectorDetailsBreadcrumbs({detector}: {detector: Detector}) {
  const organization = useOrganization();
  return (
    <Breadcrumbs
      crumbs={[
        {
          label: t('Monitors'),
          to: makeMonitorBasePathname(organization.slug),
        },
        {
          label: getDetectorTypeLabel(detector.type),
          to: makeMonitorTypePathname(organization.slug, detector.type),
        },
        {label: detector.name},
      ]}
    />
  );
}

function DetectorDetailsDefaultHeaderContent({detector}: {detector: Detector}) {
  return (
    <TopBar.Slot name="title">
      <DetectorDetailsBreadcrumbs detector={detector} />
    </TopBar.Slot>
  );
}

function DetectorDetailsDefaultActions({
  detector,
  useLocalDetailActions = false,
}: {
  detector: Detector;
  useLocalDetailActions?: boolean;
}) {
  const shouldUseLocalDetailActions =
    useLocalDetailActions ||
    detector.type === 'monitor_check_in_failure' ||
    detector.type === 'metric_issue' ||
    detector.type === 'uptime_domain_failure' ||
    detector.type === 'preprod_size_analysis';

  return (
    <Fragment>
      {shouldUseLocalDetailActions ? null : (
        <TopBar.Slot name="actions">
          <DisableDetectorAction detector={detector} />
          <EditDetectorAction detector={detector} />
        </TopBar.Slot>
      )}
      <MonitorFeedbackButton />
    </Fragment>
  );
}

export function DetectorDetailsHeader({
  detector,
  useLocalDetailActions = false,
}: DetectorDetailsHeaderProps) {
  return (
    <Fragment>
      <DetectorDetailsDefaultHeaderContent detector={detector} />
      <DetectorDetailsDefaultActions
        detector={detector}
        useLocalDetailActions={useLocalDetailActions}
      />
    </Fragment>
  );
}
