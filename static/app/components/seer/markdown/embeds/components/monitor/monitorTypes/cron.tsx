import {lazy} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {LazyLoad} from 'sentry/components/lazyLoad';
import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {CronDetector} from 'sentry/types/workflowEngine/detectors';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {getNextCheckInEnv} from 'sentry/views/alerts/rules/crons/utils';
import {monitorCheckInsApiOptions} from 'sentry/views/insights/crons/utils/monitorCheckInsApiOptions';
import {scheduleAsText} from 'sentry/views/insights/crons/utils/scheduleAsText';

const LazyMonitorCheckInsGrid = lazy(async () => {
  const {MonitorCheckInsGrid} =
    await import('sentry/views/insights/crons/components/monitorCheckInsGrid');
  return {default: MonitorCheckInsGrid};
});

function RecentCronCheckIns({
  detector,
  project,
}: {
  detector: CronDetector;
  project: Project;
}) {
  const organization = useOrganization();
  const monitor = detector.dataSources[0].queryObj;
  const {data, isError, isPending} = useQuery({
    ...monitorCheckInsApiOptions({
      orgSlug: organization.slug,
      projectSlug: project.slug,
      monitorIdOrSlug: monitor.slug,
      limit: 3,
      expand: 'groups',
      environment: monitor.environments.map(item => item.name),
    }),
    retry: false,
  });

  if (isError) {
    return <Text variant="muted">{t('Unable to load recent check-ins.')}</Text>;
  }

  return (
    <LazyLoad
      LazyComponent={LazyMonitorCheckInsGrid}
      checkIns={data ?? []}
      isLoading={isPending}
      hasMultiEnv={monitor.environments.length > 1}
      project={project}
    />
  );
}

export function CronMonitor({
  detector,
  hasOngoingIssue,
}: {
  detector: CronDetector;
  hasOngoingIssue: boolean;
}) {
  const monitor = detector.dataSources[0].queryObj;
  const environment = getNextCheckInEnv(monitor.environments);
  const project = useProjectFromId({project_id: detector.projectId});

  return (
    <Stack gap="md">
      {hasOngoingIssue ? null : (
        <Stack gap="sm">
          <Heading as="h4" size="xs">
            {t('Recent check-ins')}
          </Heading>
          {project ? (
            <ErrorBoundary mini>
              <RecentCronCheckIns detector={detector} project={project} />
            </ErrorBoundary>
          ) : (
            <Text variant="muted">{t('Unable to load recent check-ins.')}</Text>
          )}
        </Stack>
      )}
      {hasOngoingIssue ? null : <Stack.Separator />}
      <Stack gap="sm">
        <Heading as="h4" size="xs">
          {t('Monitor configuration')}
        </Heading>
        <Grid columns="max-content minmax(0, 1fr)" gap="sm md">
          <Text variant="muted">{t('Schedule')}</Text>
          <Text>{scheduleAsText(monitor.config)}</Text>
          <Text variant="muted">{t('Monitor slug')}</Text>
          <Text monospace ellipsis>
            {monitor.slug}
          </Text>
          <Text variant="muted">{t('Last check-in')}</Text>
          <Text>
            {environment?.lastCheckIn ? (
              <TimeSince date={environment.lastCheckIn} />
            ) : (
              t('No check-ins')
            )}
          </Text>
          <Text variant="muted">{t('Next check-in')}</Text>
          <Text>
            {environment?.nextCheckIn ? (
              <TimeSince date={environment.nextCheckIn} />
            ) : (
              t('Not scheduled')
            )}
          </Text>
        </Grid>
      </Stack>
    </Stack>
  );
}
