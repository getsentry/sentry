import {Fragment} from 'react';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {TimeSince} from 'sentry/components/timeSince';
import {Version} from 'sentry/components/version';
import {t, tn} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SectionDivider} from 'sentry/views/issueDetails/streamline/foldSection';

import {useAffectedReleases} from './queries/useAffectedReleases';
import {useImpactedEventsCount} from './queries/useImpactedEventsCount';
import {useSampleEvents} from './queries/useSampleEvents';

function EventsCount({project}: {project: Project}) {
  const {count, isLoading, isError} = useImpactedEventsCount({project});

  if (isLoading) {
    return <LoadingIndicator mini />;
  }
  if (isError) {
    return <LoadingError message={t('Unable to load impact data.')} />;
  }
  if (count === null) {
    return null;
  }
  return (
    <Text>
      {tn(
        '%s event with unreadable stack traces in the last 30 days',
        '%s events with unreadable stack traces in the last 30 days',
        count
      )}
    </Text>
  );
}

function AffectedReleases({project}: {project: Project}) {
  const {releases, isLoading, isError} = useAffectedReleases({project});

  if (isLoading) {
    return <LoadingIndicator mini />;
  }
  if (isError) {
    return <LoadingError message={t('Unable to load affected releases.')} />;
  }
  if (releases.length === 0) {
    return null;
  }
  return (
    <Fragment>
      <SectionDivider orientation="horizontal" margin="xs 0" />
      <Stack gap="md">
        <Text bold>{t('Affected releases')}</Text>
        <Stack gap="xs">
          {releases.map(({release, count}) => (
            <Flex key={release} align="baseline" gap="sm">
              <Version version={release} />
              <Text variant="muted">&middot;</Text>
              <Text variant="muted">{tn('%s event', '%s events', count)}</Text>
            </Flex>
          ))}
        </Stack>
      </Stack>
    </Fragment>
  );
}

function SampleEvents({project}: {project: Project}) {
  const organization = useOrganization();
  const {events, isLoading, isError} = useSampleEvents({project});

  if (isLoading) {
    return <LoadingIndicator mini />;
  }
  if (isError) {
    return <LoadingError message={t('Unable to load sample events.')} />;
  }
  if (events.length === 0) {
    return null;
  }
  return (
    <Fragment>
      <SectionDivider orientation="horizontal" margin="xs 0" />
      <Stack gap="md">
        <Text bold>{t('Sample events')}</Text>
        <Stack gap="xs">
          {events.map(({eventId, groupId, title, timestamp}) => (
            <Flex key={eventId} align="center" gap="sm">
              <Link
                to={normalizeUrl(
                  `/organizations/${organization.slug}/issues/${groupId}/events/${eventId}/`
                )}
              >
                {title}
              </Link>
              <Text variant="muted">&middot;</Text>
              <Text variant="muted">
                <TimeSince date={timestamp} unitStyle="short" />
              </Text>
            </Flex>
          ))}
        </Stack>
      </Stack>
    </Fragment>
  );
}

interface ImpactSectionProps {
  project: Project;
}

export function ImpactSection({project}: ImpactSectionProps) {
  return (
    <Stack gap="lg" padding="lg">
      <Heading as="h3">{t('Impact')}</Heading>
      <EventsCount project={project} />
      <AffectedReleases project={project} />
      <SampleEvents project={project} />
    </Stack>
  );
}
