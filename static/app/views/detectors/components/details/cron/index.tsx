import {Fragment, useCallback, useState} from 'react';
import sortBy from 'lodash/sortBy';

import {Alert} from '@sentry/scraps/alert';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {KeyValueTableRow} from 'sentry/components/keyValueTable';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import TimeSince from 'sentry/components/timeSince';
import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import Section from 'sentry/components/workflowEngine/ui/section';
import {IconJson} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {CronDetector} from 'sentry/types/workflowEngine/detectors';
import toArray from 'sentry/utils/array/toArray';
import {useLocation} from 'sentry/utils/useLocation';
import {DetectorDetailsAssignee} from 'sentry/views/detectors/components/details/common/assignee';
import {DetectorDetailsAutomations} from 'sentry/views/detectors/components/details/common/automations';
import {DetectorExtraDetails} from 'sentry/views/detectors/components/details/common/extraDetails';
import {DetectorDetailsHeader} from 'sentry/views/detectors/components/details/common/header';
import {DetectorDetailsOngoingIssues} from 'sentry/views/detectors/components/details/common/ongoingIssues';
import {DetailsTimeline} from 'sentry/views/insights/crons/components/detailsTimeline';
import {DetailsTimelineLegend} from 'sentry/views/insights/crons/components/detailsTimelineLegend';
import {MonitorCheckIns} from 'sentry/views/insights/crons/components/monitorCheckIns';
import {MonitorOnboarding} from 'sentry/views/insights/crons/components/onboarding';
import type {MonitorBucket, MonitorEnvironment} from 'sentry/views/insights/crons/types';

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
  const location = useLocation();
  const dataSource = detector.dataSources[0];

  const {failure_issue_threshold, recovery_threshold} = dataSource.queryObj.config;

  // Filter monitor environments based on the selected environment from page filters
  const selectedEnvironments = toArray(location.query.environment).filter(Boolean);
  const filteredMonitor = {
    ...dataSource.queryObj,
    environments:
      selectedEnvironments.length > 0
        ? dataSource.queryObj.environments.filter(env =>
            selectedEnvironments.includes(env.name)
          )
        : dataSource.queryObj.environments,
  };

  const monitorEnv = getLatestCronMonitorEnv({
    ...detector,
    dataSources: [
      {
        ...detector.dataSources[0],
        queryObj: filteredMonitor,
      },
    ],
  });
  const hasCheckedIn = hasLastCheckIn(filteredMonitor.environments);

  function getIntervalSecondsFromEnv(env?: MonitorEnvironment): number | undefined {
    if (!env?.lastCheckIn || !env?.nextCheckIn) {
      return 60;
    }
    const last = new Date(env.lastCheckIn).getTime();
    const next = new Date(env.nextCheckIn).getTime();
    if (!Number.isFinite(last) || !Number.isFinite(next) || next <= last) {
      return 60;
    }
    const seconds = Math.floor((next - last) / 1000);
    return Math.max(60, seconds);
  }

  const intervalSeconds = getIntervalSecondsFromEnv(monitorEnv);

  // Only display the unknown legend when there are visible unknown check-ins
  // in the timeline
  const [showUnknownLegend, setShowUnknownLegend] = useState(false);

  const checkHasUnknown = useCallback((stats: MonitorBucket[]) => {
    const hasUnknown = stats.some(bucket =>
      Object.values(bucket[1]).some(envBucket => Boolean(envBucket.unknown))
    );
    setShowUnknownLegend(hasUnknown);
  }, []);

  return (
    <DetailLayout>
      <DetectorDetailsHeader detector={detector} project={project} />
      <DetailLayout.Body>
        <DetailLayout.Main>
          <PageFilterBar condensed>
            <EnvironmentPageFilter />
            <DatePageFilter />
          </PageFilterBar>
          {hasCheckedIn ? (
            <Fragment>
              <DetailsTimeline
                monitor={filteredMonitor}
                onStatsLoaded={checkHasUnknown}
              />
              <ErrorBoundary mini>
                <DetectorDetailsOngoingIssues
                  detector={detector}
                  intervalSeconds={intervalSeconds}
                />
              </ErrorBoundary>
              <Section title={t('Recent Check-Ins')}>
                <div>
                  <MonitorCheckIns
                    monitorSlug={dataSource.queryObj.slug}
                    monitorEnvs={filteredMonitor.environments}
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
          <Section title={t('Legend')}>
            <DetailsTimelineLegend
              checkInMargin={dataSource.queryObj.config.checkin_margin}
              maxRuntime={dataSource.queryObj.config.max_runtime}
              showUnknownLegend={showUnknownLegend}
            />
          </Section>
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
