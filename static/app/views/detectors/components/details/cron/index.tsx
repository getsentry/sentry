import {Fragment, useCallback, useState} from 'react';
import moment from 'moment-timezone';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import ErrorBoundary from 'sentry/components/errorBoundary';
import useDrawer from 'sentry/components/globalDrawer';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {KeyValueTableRow} from 'sentry/components/keyValueTable';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import TimeSince from 'sentry/components/timeSince';
import {TimezoneProvider, useTimezone} from 'sentry/components/timezoneProvider';
import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import Section from 'sentry/components/workflowEngine/ui/section';
import {IconJson} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {CronDetector} from 'sentry/types/workflowEngine/detectors';
import toArray from 'sentry/utils/array/toArray';
import {useQueryClient} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  getMonitorRefetchInterval,
  getNextCheckInEnv,
} from 'sentry/views/alerts/rules/crons/utils';
import {DetectorDetailsAssignee} from 'sentry/views/detectors/components/details/common/assignee';
import {DetectorDetailsAutomations} from 'sentry/views/detectors/components/details/common/automations';
import {DetectorDetailsDescription} from 'sentry/views/detectors/components/details/common/description';
import {DisabledAlert} from 'sentry/views/detectors/components/details/common/disabledAlert';
import {DetectorExtraDetails} from 'sentry/views/detectors/components/details/common/extraDetails';
import {DetectorDetailsHeader} from 'sentry/views/detectors/components/details/common/header';
import {DetectorDetailsOpenPeriodIssues} from 'sentry/views/detectors/components/details/common/openPeriodIssues';
import {
  makeDetectorDetailsQueryKey,
  useDetectorQuery,
} from 'sentry/views/detectors/hooks';
import {DetailsTimeline} from 'sentry/views/insights/crons/components/detailsTimeline';
import {DetailsTimelineLegend} from 'sentry/views/insights/crons/components/detailsTimelineLegend';
import {MonitorCheckIns} from 'sentry/views/insights/crons/components/monitorCheckIns';
import MonitorQuickStartGuide from 'sentry/views/insights/crons/components/monitorQuickStartGuide';
import {MonitorOnboarding} from 'sentry/views/insights/crons/components/onboarding';
import {MonitorProcessingErrors} from 'sentry/views/insights/crons/components/processingErrors/monitorProcessingErrors';
import {TimezoneOverride} from 'sentry/views/insights/crons/components/timezoneOverride';
import type {MonitorBucket, MonitorEnvironment} from 'sentry/views/insights/crons/types';
import {ScheduleType} from 'sentry/views/insights/crons/types';
import {useMonitorProcessingErrors} from 'sentry/views/insights/crons/useMonitorProcessingErrors';
import {scheduleAsText} from 'sentry/views/insights/crons/utils/scheduleAsText';

type CronDetectorDetailsProps = {
  detector: CronDetector;
  project: Project;
};

function getLatestCronMonitorEnv(detector: CronDetector) {
  const environments = detector.dataSources[0].queryObj.environments;
  return getNextCheckInEnv(environments);
}

function hasLastCheckIn(envs: MonitorEnvironment[]) {
  return envs.some(e => e.lastCheckIn);
}

export function CronDetectorDetails({detector, project}: CronDetectorDetailsProps) {
  const organization = useOrganization();
  const location = useLocation();
  const dataSource = detector.dataSources[0];
  const userTimezone = useTimezone();
  const [timezoneOverride, setTimezoneOverride] = useState(userTimezone);
  const openDocsPanel = useDocsPanel(dataSource.queryObj.slug, project);
  const queryClient = useQueryClient();

  useDetectorQuery<CronDetector>(detector.id, {
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: query => {
      if (!query.state.data) {
        return false;
      }
      const [cronDetector] = query.state.data;
      const monitor = cronDetector.dataSources[0].queryObj;
      return getMonitorRefetchInterval(monitor, new Date());
    },
  });

  const handleEnvironmentUpdated = useCallback(() => {
    const queryKey = makeDetectorDetailsQueryKey({
      orgSlug: organization.slug,
      detectorId: detector.id,
    });
    queryClient.invalidateQueries({queryKey});
  }, [queryClient, organization.slug, detector.id]);

  const {checkinErrors, handleDismissError} = useMonitorProcessingErrors({
    organization,
    projectId: project.id,
    monitorSlug: dataSource.queryObj.slug,
  });

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
    <TimezoneProvider timezone={timezoneOverride}>
      <DetailLayout>
        <DetectorDetailsHeader detector={detector} project={project} />
        <DetailLayout.Body>
          <DetailLayout.Main>
            <Flex gap="sm" justify="between" align="center">
              <PageFilterBar condensed>
                <EnvironmentPageFilter />
                <DatePageFilter />
              </PageFilterBar>
              <TimezoneOverride
                monitor={dataSource.queryObj}
                userTimezone={userTimezone}
                onTimezoneSelected={setTimezoneOverride}
              />
            </Flex>
            <DisabledAlert
              detector={detector}
              message={t('This monitor is disabled and not accepting check-ins.')}
            />
            {!!checkinErrors?.length && (
              <MonitorProcessingErrors
                checkinErrors={checkinErrors}
                onDismiss={handleDismissError}
              >
                {t('Errors were encountered while ingesting check-ins for this monitor')}
              </MonitorProcessingErrors>
            )}
            {hasCheckedIn ? (
              <Fragment>
                <DetailsTimeline
                  monitor={filteredMonitor}
                  onStatsLoaded={checkHasUnknown}
                  onEnvironmentUpdated={handleEnvironmentUpdated}
                />
                <ErrorBoundary mini>
                  <DetectorDetailsOpenPeriodIssues
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
              <MonitorOnboarding
                monitorSlug={dataSource.queryObj.slug}
                project={project}
              />
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
            <Section title={t('Schedule')}>
              <div>
                {scheduleAsText(dataSource.queryObj.config)}{' '}
                {dataSource.queryObj.config.schedule_type === ScheduleType.CRONTAB &&
                  `(${dataSource.queryObj.config.timezone}) `}
                {dataSource.queryObj.config.schedule_type === ScheduleType.CRONTAB && (
                  <Text variant="muted" monospace>
                    ({dataSource.queryObj.config.schedule})
                  </Text>
                )}
              </div>
            </Section>
            <Section title={t('Legend')}>
              <DetailsTimelineLegend
                checkInMargin={dataSource.queryObj.config.checkin_margin}
                maxRuntime={dataSource.queryObj.config.max_runtime}
                showUnknownLegend={showUnknownLegend}
              />
            </Section>
            <DetectorDetailsDescription description={detector.description} />
            <DetectorExtraDetails>
              <KeyValueTableRow
                keyName={t('Monitor slug')}
                value={
                  <Flex gap="xs" align="center">
                    <Text ellipsis>{dataSource.queryObj.slug}</Text>
                    <CopyToClipboardButton
                      text={dataSource.queryObj.slug}
                      aria-label={t('Copy monitor slug to clipboard')}
                      size="zero"
                      borderless
                    />
                  </Flex>
                }
              />
              <KeyValueTableRow
                keyName={t('Next check-in')}
                value={
                  dataSource.queryObj.status !== 'disabled' && monitorEnv?.nextCheckIn ? (
                    moment(monitorEnv.nextCheckIn).isAfter(moment()) ? (
                      <TimeSince
                        unitStyle="regular"
                        liveUpdateInterval="second"
                        date={monitorEnv.nextCheckIn}
                      />
                    ) : (
                      t('Expected Now')
                    )
                  ) : (
                    '-'
                  )
                }
              />
              <KeyValueTableRow
                keyName={t('Last check-in')}
                value={
                  monitorEnv?.lastCheckIn ? (
                    <TimeSince
                      unitStyle="regular"
                      liveUpdateInterval="second"
                      date={monitorEnv.lastCheckIn}
                    />
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
              <Alert type="subtle" icon={<IconJson />}>
                {t(
                  'This monitor is managed in code and updates automatically with each check-in.'
                )}
              </Alert>
            )}
            {hasCheckedIn && (
              <Flex>
                <Button size="xs" onClick={openDocsPanel}>
                  {t('Show Setup Docs')}
                </Button>
              </Flex>
            )}
          </DetailLayout.Sidebar>
        </DetailLayout.Body>
      </DetailLayout>
    </TimezoneProvider>
  );
}

function useDocsPanel(monitorSlug: string, project: Project) {
  const {openDrawer} = useDrawer();

  const contents = (
    <Fragment>
      <DrawerHeader hideBar />
      <DrawerBody>
        <MonitorQuickStartGuide project={project} monitorSlug={monitorSlug} />
      </DrawerBody>
    </Fragment>
  );

  return () =>
    openDrawer(() => contents, {
      ariaLabel: t('See Setup Docs'),
      drawerKey: 'cron-docs',
      resizable: true,
    });
}
