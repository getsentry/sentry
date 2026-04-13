import React from 'react';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {TimeSince} from 'sentry/components/timeSince';
import {Version} from 'sentry/components/version';
import {t, tn} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SectionDivider} from 'sentry/views/issueDetails/streamline/foldSection';

import {
  useAffectedReleasesQuery,
  useProcessingErrorsQuery,
  useSampleEventsQuery,
} from './useProcessingErrorsQuery';

interface ImpactSectionProps {
  projectId: string;
}

export function ImpactSection({projectId}: ImpactSectionProps) {
  const organization = useOrganization();
  const {count, isLoading, isError} = useProcessingErrorsQuery({projectId});
  const {
    releases,
    isLoading: releasesLoading,
    isError: releasesError,
  } = useAffectedReleasesQuery({projectId});
  const {
    events,
    isLoading: eventsLoading,
    isError: eventsError,
  } = useSampleEventsQuery({projectId});

  function renderCount() {
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

  function renderReleases() {
    if (releasesLoading) {
      return <LoadingIndicator mini />;
    }
    if (releasesError) {
      return <LoadingError message={t('Unable to load affected releases.')} />;
    }
    if (releases.length === 0) {
      return null;
    }
    return (
      <Stack gap="md">
        <Text bold>{t('Affected releases')}</Text>
        <Stack gap="xs">
          {releases.map(({release, count: eventCount}) => (
            <Flex key={release} align="baseline" gap="sm">
              <Version version={release} />
              <Text variant="muted">&middot;</Text>
              <Text variant="muted">{tn('%s event', '%s events', eventCount)}</Text>
            </Flex>
          ))}
        </Stack>
      </Stack>
    );
  }

  function renderSampleEvents() {
    if (eventsLoading) {
      return <LoadingIndicator mini />;
    }
    if (eventsError) {
      return <LoadingError message={t('Unable to load sample events.')} />;
    }
    if (events.length === 0) {
      return null;
    }
    return (
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
    );
  }

  const releasesContent = renderReleases();
  const sampleEventsContent = renderSampleEvents();

  return (
    <Stack gap="lg" padding="lg">
      <Heading as="h3">{t('Impact')}</Heading>
      {renderCount()}
      {releasesContent && (
        <React.Fragment>
          <SectionDivider orientation="horizontal" margin="xs 0" />
          {releasesContent}
        </React.Fragment>
      )}
      {sampleEventsContent && (
        <React.Fragment>
          <SectionDivider orientation="horizontal" margin="xs 0" />
          {sampleEventsContent}
        </React.Fragment>
      )}
    </Stack>
  );
}
