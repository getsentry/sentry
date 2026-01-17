import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';
import {SidebarSectionTitle} from 'sentry/views/issueDetails/streamline/sidebar/sidebar';

export interface DetectorDetails {
  description?: string;
  detectorId?: string;
  detectorPath?: string;
  detectorSlug?: string;
  detectorType?: 'metric_alert' | 'cron_monitor' | 'uptime_monitor';
}

export function getDetectorDetails({
  event,
  organization,
  project,
}: {
  event: Event;
  organization: Organization;
  project: Project;
}): DetectorDetails {
  /**
   * Rather than check the issue category, we just check all the current set locations
   * for Alert Rule IDs. Hopefully we can consolidate this when we move to the detector system.
   * Ideally, this function wouldn't even check the event, but rather the group/issue.
   */
  const isMetricAlert = event?.occurrence?.type === 8001; // the issue type for metric issues is 8001

  if (isMetricAlert) {
    const detectorId = event.occurrence?.evidenceData.detectorId;
    return {
      detectorType: 'metric_alert',
      detectorId,
      detectorPath: makeMonitorDetailsPathname(organization.slug, detectorId),
      description: t(
        'This issue was created by a metric monitor. View the monitor details to learn more.'
      ),
    };
  }

  const cronSlug = event?.tags?.find(({key}) => key === 'monitor.slug')?.value;
  const cronId = event?.tags?.find(({key}) => key === 'monitor.id')?.value;
  if (cronSlug) {
    return {
      detectorType: 'cron_monitor',
      detectorId: cronId,
      detectorSlug: cronSlug,
      detectorPath: makeAlertsPathname({
        path: `/rules/crons/${project.slug}/${cronSlug}/details/`,
        organization,
      }),
      description: t(
        'This issue was created by a cron monitor. View the monitor details to learn more.'
      ),
    };
  }

  const detectorId: number | undefined = event.occurrence?.evidenceData.detectorId;
  if (detectorId) {
    return {
      detectorType: 'uptime_monitor',
      detectorId: String(detectorId),
      detectorPath: makeAlertsPathname({
        path: `/rules/uptime/${project.slug}/${detectorId}/details/`,
        organization,
      }),
      // TODO(issues): Update this to mention detectors when that language is user-facing
      description: t('This issue was created by an uptime monitoring alert rule.'),
    };
  }
  return {};
}

export function DetectorSection({group, project}: {group: Group; project: Project}) {
  const issueConfig = getConfigForIssueType(group, project);
  const {detectorDetails} = useIssueDetails();
  const {detectorPath, description} = detectorDetails;

  if (!detectorPath) {
    return null;
  }

  return (
    <div>
      <SidebarSectionTitle>
        {issueConfig.detector.title ?? t('Detector')}
      </SidebarSectionTitle>
      {description && <DetectorDescription>{description}</DetectorDescription>}
      <LinkButton
        aria-label={issueConfig.detector.ctaText ?? t('View detector details')}
        to={detectorPath}
        style={{width: '100%'}}
        size="sm"
      >
        {issueConfig.detector.ctaText ?? t('View detector details')}
      </LinkButton>
    </div>
  );
}

const DetectorDescription = styled('p')`
  margin: ${space(1)} 0;
`;
