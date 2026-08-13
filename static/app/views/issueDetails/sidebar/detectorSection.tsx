import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import {IssueType, type Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';
import {useIssueDetails} from 'sentry/views/issueDetails/context';
import type {DetectorDetails} from 'sentry/views/issueDetails/sidebar/detectorDetails';
import {SidebarSectionTitle} from 'sentry/views/issueDetails/sidebar/sidebar';

export function getDetectorDetails({
  group,
  organization,
}: {
  group: Group;
  organization: Organization;
}): DetectorDetails {
  const detectorId = group.detectorId;
  if (!detectorId) {
    return {};
  }

  const detectorPath = makeMonitorDetailsPathname(organization.slug, detectorId);

  switch (group.issueType) {
    case IssueType.METRIC_ISSUE:
      return {
        detectorType: 'metric_alert',
        detectorId,
        detectorPath,
        description: t(
          'This issue was created by a metric monitor. View the monitor details to learn more.'
        ),
      };
    case IssueType.MONITOR_CHECK_IN_FAILURE:
      return {
        detectorType: 'cron_monitor',
        detectorId,
        detectorPath,
        description: t(
          'This issue was created by a cron monitor. View the monitor details to learn more.'
        ),
      };
    case IssueType.PREPROD_SIZE_ANALYSIS:
      return {
        detectorType: 'mobile_build_monitor',
        detectorId,
        detectorPath,
        description: t(
          'This issue was created by a mobile build monitor. View the monitor details to learn more.'
        ),
      };
    case IssueType.UPTIME_DOMAIN_FAILURE:
      return {
        detectorType: 'uptime_monitor',
        detectorId,
        detectorPath,
        description: t('This issue was created by an uptime monitor.'),
      };
    default:
      return {};
  }
}

export function DetectorSection({group, project}: {group: Group; project: Project}) {
  const issueConfig = getConfigForIssueType(group, project);
  const {detectorDetails} = useIssueDetails();
  const {detectorPath, description} = detectorDetails;
  const detectorCtaText = issueConfig.detector.ctaText ?? t('View detector details');
  const title = issueConfig.detector.title ?? t('Detector');

  return (
    <DetectorSectionContent
      ctaText={detectorCtaText}
      description={description}
      title={title}
      to={detectorPath}
    />
  );
}

function DetectorSectionContent({
  ctaText,
  description,
  title,
  to,
}: {
  ctaText: string;
  title: string;
  description?: string;
  to?: string;
}) {
  if (!to) {
    return null;
  }

  return (
    <div>
      <SidebarSectionTitle>{title}</SidebarSectionTitle>
      {description && <DetectorDescription>{description}</DetectorDescription>}
      <LinkButton
        aria-label={ctaText}
        to={to}
        style={{width: '100%'}}
        size="sm"
        analyticsEventKey="issue_details.detector_details_link_clicked"
        analyticsEventName="Issue Details: Detector Details Link Clicked"
      >
        {ctaText}
      </LinkButton>
    </div>
  );
}

const DetectorDescription = styled('p')`
  margin: ${p => p.theme.space.md} 0;
`;
