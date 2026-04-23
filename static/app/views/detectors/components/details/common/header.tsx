import {Fragment} from 'react';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {DetailLayout} from 'sentry/components/workflowEngine/layout/detail';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
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
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

type DetectorDetailsHeaderProps = {
  detector: Detector;
  project: Project;
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

export function DetectorDetailsDefaultHeaderContent({
  detector,
  project,
}: {
  detector: Detector;
  project: Project;
}) {
  const hasPageFrameFeature = useHasPageFrameFeature();

  if (hasPageFrameFeature) {
    return (
      <TopBar.Slot name="title">
        <DetectorDetailsBreadcrumbs detector={detector} />
      </TopBar.Slot>
    );
  }

  return (
    <DetailLayout.HeaderContent>
      <DetectorDetailsBreadcrumbs detector={detector} />
      <DetailLayout.Title title={detector.name} project={project} />
    </DetailLayout.HeaderContent>
  );
}

function DetectorDetailsDefaultActions({
  detector,
  useLocalDetailActions = false,
}: {
  detector: Detector;
  useLocalDetailActions?: boolean;
}) {
  const hasPageFrameFeature = useHasPageFrameFeature();
  const shouldUseLocalDetailActions =
    hasPageFrameFeature &&
    (useLocalDetailActions ||
      detector.type === 'monitor_check_in_failure' ||
      detector.type === 'metric_issue' ||
      detector.type === 'uptime_domain_failure' ||
      detector.type === 'preprod_size_analysis');

  return hasPageFrameFeature ? (
    <Fragment>
      {shouldUseLocalDetailActions ? null : (
        <TopBar.Slot name="actions">
          <DisableDetectorAction detector={detector} />
          <EditDetectorAction detector={detector} />
        </TopBar.Slot>
      )}
      <MonitorFeedbackButton />
    </Fragment>
  ) : (
    <DetailLayout.Actions>
      <MonitorFeedbackButton />
      <DisableDetectorAction detector={detector} />
      <EditDetectorAction detector={detector} />
    </DetailLayout.Actions>
  );
}

export function DetectorDetailsHeader({
  detector,
  project,
  useLocalDetailActions = false,
}: DetectorDetailsHeaderProps) {
  const hasPageFrameFeature = useHasPageFrameFeature();

  if (hasPageFrameFeature) {
    return (
      <Fragment>
        <DetectorDetailsDefaultHeaderContent detector={detector} project={project} />
        <DetectorDetailsDefaultActions
          detector={detector}
          useLocalDetailActions={useLocalDetailActions}
        />
      </Fragment>
    );
  }

  return (
    <DetailLayout.Header>
      <DetectorDetailsDefaultHeaderContent detector={detector} project={project} />
      <DetectorDetailsDefaultActions
        detector={detector}
        useLocalDetailActions={useLocalDetailActions}
      />
    </DetailLayout.Header>
  );
}
