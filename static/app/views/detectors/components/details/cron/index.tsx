import {Fragment} from 'react';
import sortBy from 'lodash/sortBy';

import {Alert} from 'sentry/components/core/alert';
import {KeyValueTableRow} from 'sentry/components/keyValueTable';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import TimeSince from 'sentry/components/timeSince';
import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import Section from 'sentry/components/workflowEngine/ui/section';
import {IconJson} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {CronDetector} from 'sentry/types/workflowEngine/detectors';
import {DetectorDetailsAssignee} from 'sentry/views/detectors/components/details/common/assignee';
import {DetectorDetailsAutomations} from 'sentry/views/detectors/components/details/common/automations';
import {DetectorExtraDetails} from 'sentry/views/detectors/components/details/common/extraDetails';
import {DetectorDetailsHeader} from 'sentry/views/detectors/components/details/common/header';
import {DetectorDetailsOngoingIssues} from 'sentry/views/detectors/components/details/common/ongoingIssues';
import {MonitorCheckIns} from 'sentry/views/insights/crons/components/monitorCheckIns';
import {MonitorOnboarding} from 'sentry/views/insights/crons/components/onboarding';
import type {MonitorEnvironment} from 'sentry/views/insights/crons/types';

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

function hasLastCheckIn(envs: MonitorEnvironment[]) {
  return envs.some(e => e.lastCheckIn);
}

export function CronDetectorDetails({detector, project}: CronDetectorDetailsProps) {
  const dataSource = detector.dataSources[0];

  const {failure_issue_threshold, recovery_threshold} = dataSource.queryObj.config;

  const monitorEnv = getLatestCronMonitorEnv(detector);
  const hasCheckedIn = hasLastCheckIn(dataSource.queryObj.environments);

  return (
    <DetailLayout>
      <DetectorDetailsHeader detector={detector} project={project} />
      <DetailLayout.Body>
        <DetailLayout.Main>
          {hasCheckedIn ? (
            <Fragment>
              <DatePageFilter />
              {/* TODO: Add check-in chart */}
              <DetectorDetailsOngoingIssues detectorId={detector.id} />
              <Section title={t('Recent Check-Ins')}>
                <div>
                  <MonitorCheckIns
                    monitorSlug={dataSource.queryObj.slug}
                    monitorEnvs={dataSource.queryObj.environments}
                    project={project}
                  />
                </div>
              </Section>
              <DetectorDetailsAutomations detector={detector} />
            </Fragment>
          ) : (
            <MonitorOnboarding monitorSlug={dataSource.queryObj.slug} project={project} />
          )}
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
          {dataSource.queryObj.isUpserting && (
            <Alert.Container>
              <Alert type="muted" icon={<IconJson />}>
                {t(
                  'This monitor is managed in code and updates automatically with each check-in.'
                )}
              </Alert>
            </Alert.Container>
          )}
        </DetailLayout.Sidebar>
      </DetailLayout.Body>
    </DetailLayout>
  );
}
