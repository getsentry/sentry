import sortBy from 'lodash/sortBy';

import {KeyValueTableRow} from 'sentry/components/keyValueTable';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import TimeSince from 'sentry/components/timeSince';
import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t, tn} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {CronDetector} from 'sentry/types/workflowEngine/detectors';
import {DetectorDetailsAssignee} from 'sentry/views/detectors/components/details/common/assignee';
import {DetectorDetailsAutomations} from 'sentry/views/detectors/components/details/common/automations';
import {DetectorExtraDetails} from 'sentry/views/detectors/components/details/common/extraDetails';
import {DetectorDetailsHeader} from 'sentry/views/detectors/components/details/common/header';
import {DetectorDetailsOngoingIssues} from 'sentry/views/detectors/components/details/common/ongoingIssues';

type CronDetectorDetailsProps = {
  detector: CronDetector;
  project: Project;
};

function getLatestCronMonitorEnv(detector: CronDetector) {
  const dataSource = detector.dataSources[0];
  const envsSortedByLastCheck = sortBy(
    dataSource.queryObj.environments,
    e => e.lastCheckIn
  );
  return envsSortedByLastCheck[envsSortedByLastCheck.length - 1];
}

export function CronDetectorDetails({detector, project}: CronDetectorDetailsProps) {
  const dataSource = detector.dataSources[0];

  const {failure_issue_threshold, recovery_threshold} = dataSource.queryObj.config;

  const monitorEnv = getLatestCronMonitorEnv(detector);

  return (
    <DetailLayout>
      <DetectorDetailsHeader detector={detector} project={project} />
      <DetailLayout.Body>
        <DetailLayout.Main>
          <DatePageFilter />
          {/* TODO: Add check-in chart */}
          <DetectorDetailsOngoingIssues detectorId={detector.id} />
          <DetectorDetailsAutomations detector={detector} />
          {/* TODO: Add recent check-ins table */}
        </DetailLayout.Main>
        <DetailLayout.Sidebar>
          <Section title={t('Detect')}>
            {tn(
              'One failed check-in.',
              '%s consecutive failed check-ins.',
              failure_issue_threshold ?? 1
            )}
          </Section>
          <Section title={t('Resolve')}>
            {tn(
              'One successful check-in.',
              '%s consecutive successful check-ins.',
              recovery_threshold ?? 1
            )}
          </Section>
          <DetectorDetailsAssignee owner={detector.owner} />
          <DetectorExtraDetails>
            <KeyValueTableRow
              keyName={t('Monitor slug')}
              value={dataSource.queryObj.slug}
            />
            <KeyValueTableRow
              keyName={t('Next check-in')}
              value={
                dataSource.queryObj.status !== 'disabled' && monitorEnv?.nextCheckIn ? (
                  <TimeSince unitStyle="regular" date={monitorEnv.nextCheckIn} />
                ) : (
                  '-'
                )
              }
            />
            <KeyValueTableRow
              keyName={t('Last check-in')}
              value={
                monitorEnv?.lastCheckIn ? (
                  <TimeSince unitStyle="regular" date={monitorEnv.lastCheckIn} />
                ) : (
                  '-'
                )
              }
            />
            <DetectorExtraDetails.DateCreated detector={detector} />
            <DetectorExtraDetails.CreatedBy detector={detector} />
            <DetectorExtraDetails.LastModified detector={detector} />
          </DetectorExtraDetails>
        </DetailLayout.Sidebar>
      </DetailLayout.Body>
    </DetailLayout>
  );
}
