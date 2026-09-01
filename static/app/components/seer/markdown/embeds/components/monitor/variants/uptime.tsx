import {lazy} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tn} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {uptimeChecksApiOptions} from 'sentry/views/insights/uptime/utils/uptimeChecksApiOptions';

const LazyUptimeChecksGrid = lazy(async () => {
  const {UptimeChecksGrid} =
    await import('sentry/views/detectors/components/uptime/uptimeChecksGrid');
  return {default: UptimeChecksGrid};
});

function RecentUptimeCheckIns({
  detector,
  project,
}: {
  detector: UptimeDetector;
  project: Project;
}) {
  const organization = useOrganization();
  const {data, isError, isPending} = useQuery({
    ...uptimeChecksApiOptions({
      orgSlug: organization.slug,
      projectSlug: project.slug,
      detectorId: detector.id,
      limit: 3,
    }),
    retry: false,
  });

  if (isError) {
    return <Text variant="muted">{t('Unable to load recent check-ins.')}</Text>;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  return (
    <LazyLoad
      LazyComponent={LazyUptimeChecksGrid}
      uptimeChecks={data}
      traceSampling={detector.dataSources[0].queryObj.traceSampling}
    />
  );
}

export function UptimeMonitor({
  detector,
  hasOngoingIssue,
}: {
  detector: UptimeDetector;
  hasOngoingIssue: boolean;
}) {
  const {queryObj} = detector.dataSources[0];
  const project = useProjectFromId({project_id: detector.projectId});

  return (
    <Stack gap="md">
      {hasOngoingIssue ? null : (
        <Stack gap="sm">
          <Heading as="h4" size="xs">
            {t('Recent check-ins')}
          </Heading>
          {project ? (
            <RecentUptimeCheckIns detector={detector} project={project} />
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
        <Text monospace wordBreak="break-all">
          {queryObj.method} {queryObj.url}
        </Text>
        <Grid columns="max-content minmax(0, 1fr)" gap="sm md">
          <Text variant="muted">{t('Interval')}</Text>
          <Text>{t('Every %s', getDuration(queryObj.intervalSeconds))}</Text>
          <Text variant="muted">{t('Timeout')}</Text>
          <Text>{t('After %s', getDuration(queryObj.timeoutMs / 1000, 2))}</Text>
          <Text variant="muted">{t('Creates an issue')}</Text>
          <Text>
            {tn(
              'After one failed check',
              'After %s consecutive failed checks',
              detector.config.downtimeThreshold
            )}
          </Text>
          <Text variant="muted">{t('Resolves')}</Text>
          <Text>
            {tn(
              'After one successful check',
              'After %s consecutive successful checks',
              detector.config.recoveryThreshold
            )}
          </Text>
        </Grid>
      </Stack>
    </Stack>
  );
}
