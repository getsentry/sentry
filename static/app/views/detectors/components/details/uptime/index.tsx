import {useCallback, useState} from 'react';

import {CodeBlock} from 'sentry/components/core/code';
import {KeyValueTableRow} from 'sentry/components/keyValueTable';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t, tn} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import getDuration from 'sentry/utils/duration/getDuration';
import {DetailsTimeline} from 'sentry/views/alerts/rules/uptime/detailsTimeline';
import {DetailsTimelineLegend} from 'sentry/views/alerts/rules/uptime/detailsTimelineLegend';
import {
  CheckStatus,
  type CheckStatusBucket,
} from 'sentry/views/alerts/rules/uptime/types';
import {UptimeChecksTable} from 'sentry/views/alerts/rules/uptime/uptimeChecksTable';
import {DetectorDetailsAssignee} from 'sentry/views/detectors/components/details/common/assignee';
import {DetectorDetailsAutomations} from 'sentry/views/detectors/components/details/common/automations';
import {DetectorExtraDetails} from 'sentry/views/detectors/components/details/common/extraDetails';
import {DetectorDetailsHeader} from 'sentry/views/detectors/components/details/common/header';

type UptimeDetectorDetailsProps = {
  detector: UptimeDetector;
  project: Project;
};

export function UptimeDetectorDetails({detector, project}: UptimeDetectorDetailsProps) {
  const dataSource = detector.dataSources[0];

  // Only display the missed window legend when there are visible missed window
  // check-ins in the timeline
  const [showMissedLegend, setShowMissedLegend] = useState(false);

  const checkHasUnknown = useCallback((stats: CheckStatusBucket[]) => {
    const hasUnknown = stats.some(bucket =>
      Boolean(bucket[1][CheckStatus.MISSED_WINDOW])
    );
    setShowMissedLegend(hasUnknown);
  }, []);

  return (
    <DetailLayout>
      <DetectorDetailsHeader detector={detector} project={project} />
      <DetailLayout.Body>
        <DetailLayout.Main>
          <DatePageFilter />
          <DetailsTimeline uptimeDetector={detector} onStatsLoaded={checkHasUnknown} />
          <Section title={t('Recent Check-Ins')}>
            <div>
              <UptimeChecksTable
                detectorId={detector.id}
                projectSlug={project.slug}
                traceSampling={detector.dataSources[0].queryObj.traceSampling}
              />
            </div>
          </Section>
          <DetectorDetailsAutomations detector={detector} />
        </DetailLayout.Main>
        <DetailLayout.Sidebar>
          <Section title={t('Detect')}>
            <div>
              {tn(
                '%s failed check.',
                '%s consecutive failed checks.',
                detector.config.downtimeThreshold
              )}
            </div>
            <CodeBlock
              hideCopyButton
            >{`${dataSource.queryObj.method} ${dataSource.queryObj.url}`}</CodeBlock>
          </Section>
          <Section title={t('Resolve')}>
            {tn(
              '%s successful check.',
              '%s consecutive successful checks.',
              detector.config.recoveryThreshold
            )}
          </Section>
          <Section title={t('Legend')}>
            <DetailsTimelineLegend showMissedLegend={showMissedLegend} />
          </Section>
          <DetectorDetailsAssignee owner={detector.owner} />
          <DetectorExtraDetails>
            <KeyValueTableRow
              keyName={t('Interval')}
              value={t('Every %s', getDuration(dataSource.queryObj.intervalSeconds))}
            />
            <KeyValueTableRow
              keyName={t('Timeout')}
              value={t('After %s', getDuration(dataSource.queryObj.timeoutMs / 1000, 2))}
            />
            <DetectorExtraDetails.Environment detector={detector} />
            <DetectorExtraDetails.DateCreated detector={detector} />
            <DetectorExtraDetails.CreatedBy detector={detector} />
            <DetectorExtraDetails.LastModified detector={detector} />
          </DetectorExtraDetails>
        </DetailLayout.Sidebar>
      </DetailLayout.Body>
    </DetailLayout>
  );
}
