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
    return <LoadingError message={t('Unable to load impacted events count.')} />;
  }
  if (!count) {
    return <Text>{t('No impacted events found in the last 30 days.')}</Text>;
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

  function renderContent() {
    if (isLoading) {
      return <LoadingIndicator mini />;
    }
    if (isError) {
      return <LoadingError message={t('Unable to load affected releases.')} />;
    }
    if (releases.length === 0) {
      return <Text>{t('No affected releases found in the last 30 days.')}</Text>;
    }
    return (
      <Stack gap="xs">
        {releases.map(({release, count}) => (
          <Flex key={release} align="baseline" gap="sm">
            <Version version={release} />
            <Text variant="muted">&middot;</Text>
            <Text variant="muted">{tn('%s event', '%s events', count)}</Text>
          </Flex>
        ))}
      </Stack>
    );
  }

  return (
    <Fragment>
      <SectionDivider orientation="horizontal" margin="xs 0" />
      <Stack gap="md">
        <Heading as="h4">{t('Affected releases')}</Heading>
        {renderContent()}
      </Stack>
    </Fragment>
  );
}

function SampleEvents({project}: {project: Project}) {
  const organization = useOrganization();
  const {events, isLoading, isError} = useSampleEvents({project});

  function renderContent() {
    if (isLoading) {
      return <LoadingIndicator mini />;
    }
    if (isError) {
      return <LoadingError message={t('Unable to load sample events.')} />;
    }
    if (events.length === 0) {
      return <Text>{t('No sample events found in the last 30 days.')}</Text>;
    }
    return (
      <Stack gap="xs">
        {events.map(({event_id, group_id, title, timestamp}) => (
          <Flex key={event_id} align="center" gap="sm">
            {group_id ? (
              <Link
                to={normalizeUrl(
                  `/organizations/${organization.slug}/issues/${group_id}/events/${event_id}/`
                )}
              >
                {title}
              </Link>
            ) : (
              <Text variant="muted">{title}</Text>
            )}
            <Text variant="muted">&middot;</Text>
            <Text variant="muted">
              <TimeSince date={timestamp} unitStyle="short" />
            </Text>
          </Flex>
        ))}
      </Stack>
    );
  }

  return (
    <Fragment>
      <SectionDivider orientation="horizontal" margin="xs 0" />
      <Stack gap="md">
        <Heading as="h4">{t('Sample events')}</Heading>
        {renderContent()}
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
