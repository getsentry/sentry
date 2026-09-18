import {Fragment} from 'react';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
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

type DetectorDetailsHeaderProps = {detector: Detector; useLocalDetailActions?: boolean};

function DetectorDetailsBreadcrumbs({detector}: {detector: Detector}) {
  const organization = useOrganization();
  return (
    <BreadcrumbList
      items={[
        {
          type: 'link',
          label: t('Monitors'),
          to: makeMonitorBasePathname(organization.slug),
        },
        {
          type: 'link',
          label: getDetectorTypeLabel(detector.type),
          to: makeMonitorTypePathname(organization.slug, detector.type),
        },
      ]}
    />
  );
}

function DetectorDetailsTitle({detector}: {detector: Detector}) {
  const project = useProjectFromId({project_id: detector.projectId ?? undefined});

  return (
    <BreadcrumbList.Title
      item={{
        type: 'page-title',
        label: detector.name,
        leadingGraphic: project ? (
          <ProjectBadge disableLink hideName project={project} avatarSize={16} />
        ) : (
          <Placeholder width="16px" height="16px" />
        ),
      }}
    />
  );
}

function DetectorDetailsDefaultHeaderContent({detector}: {detector: Detector}) {
  return (
    <Fragment>
      <TopBar.Slot name="breadcrumbs">
        <DetectorDetailsBreadcrumbs detector={detector} />
      </TopBar.Slot>
      <TopBar.Slot name="title">
        <DetectorDetailsTitle detector={detector} />
      </TopBar.Slot>
    </Fragment>
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
