import {useQuery} from '@tanstack/react-query';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {EventMessage} from 'sentry/components/events/eventMessage';
import {HighlightsIconSummary} from 'sentry/components/events/highlights/highlightsIconSummary';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {EventTagsView} from 'sentry/components/seer/markdown/embeds/components/event/eventTagsView';
import {EventTagView} from 'sentry/components/seer/markdown/embeds/components/event/eventTagView';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {TimeSince} from 'sentry/components/timeSince';
import {IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event, Level} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {getMessage, getTitle} from 'sentry/utils/events';
import {useOrganization} from 'sentry/utils/useOrganization';
import {groupEventApiOptions} from 'sentry/views/issueDetails/utils';

import {getEventLinkTitle} from './eventLink';
import {
  makeEventPathname,
  makeIssueDistributionsPathname,
  makeIssueTagDistributionPathname,
} from './eventPathnames';

type EventData = EmbedOutput<'event'>;

function EventSummary({event}: {event: Event}) {
  const {title, subtitle} = getTitle(event);
  const level = event.tags?.find(tag => tag.key === 'level')?.value as Level | undefined;
  const culprit = event.culprit || subtitle;
  const date = event.dateCreated ?? event.dateReceived;

  return (
    <Stack gap="sm">
      <Text bold ellipsis size="lg">
        {title}
      </Text>
      <Text size="sm" variant="muted">
        <EventMessage message={getMessage(event)} type={event.type} level={level} />
      </Text>
      {culprit ? (
        <Text ellipsis size="sm" variant="muted">
          {culprit}
        </Text>
      ) : null}
      {date ? (
        <Text size="sm" variant="muted">
          <TimeSince date={date} />
        </Text>
      ) : null}
      <HighlightsIconSummary event={event} />
    </Stack>
  );
}

/**
 * Renders whichever extra section `view` asked for underneath the summary.
 * Adding a view is a new file plus a case here -- the conditions each view
 * needs (hrefs, project slug) are derived once below and passed in as props.
 */
function EventBlockView({
  view,
  tagKey,
  event,
  issueId,
  organization,
  distributionsHref,
}: {
  distributionsHref: string;
  event: Event;
  issueId: string;
  organization: Organization;
  tagKey: string | undefined;
  view: EventData['view'];
}) {
  switch (view) {
    case 'tags':
      return (
        <EventTagsView
          event={event}
          projectSlug={event.projectSlug}
          distributionsHref={distributionsHref}
        />
      );
    case 'tag':
      // `tagKey` is required for this view; the caller already fell back to the
      // summary when it is missing, so this is unreachable in practice.
      return tagKey ? (
        <EventTagView
          issueId={issueId}
          organization={organization}
          tagKey={tagKey}
          tagHref={makeIssueTagDistributionPathname({
            organizationSlug: organization.slug,
            issueId,
            tagKey,
          })}
        />
      ) : null;
    case 'summary':
    default:
      return null;
  }
}

export default function SeerEventBlock({id, issueId, shortId, view, tagKey}: EventData) {
  const organization = useOrganization();
  // A `tag` view without a tag key has nothing to break down -- show the summary.
  const resolvedView = view === 'tag' && !tagKey ? 'summary' : view;
  const eventHref = makeEventPathname({
    organizationSlug: organization.slug,
    issueId,
    eventId: id,
  });
  const distributionsHref = makeIssueDistributionsPathname({
    organizationSlug: organization.slug,
    issueId,
  });

  const {
    data: event,
    isPending,
    isError,
  } = useQuery({
    ...groupEventApiOptions({
      orgSlug: organization.slug,
      groupId: issueId,
      eventId: id,
      // Deliberately empty: the embed must not inherit the host page's filters.
      environments: [],
    }),
    retry: false,
  });

  return (
    <Container
      background="primary"
      border="primary"
      containerType="inline-size"
      data-test-id="seer-event-embed"
      padding="lg"
      radius="md"
      width="100%"
    >
      <Stack gap="lg">
        <ResourceLink
          icon={IconFire}
          href={eventHref}
          title={getEventLinkTitle({id, shortId})}
        />

        {isPending ? (
          <Flex justify="center" padding="md">
            <LoadingIndicator mini />
          </Flex>
        ) : isError || !event ? (
          <Text variant="muted">{t('Unable to load event details')}</Text>
        ) : (
          <Stack gap="lg">
            <EventSummary event={event} />
            <EventBlockView
              view={resolvedView}
              tagKey={tagKey}
              event={event}
              issueId={issueId}
              organization={organization}
              distributionsHref={distributionsHref}
            />
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
