import {useQuery} from '@tanstack/react-query';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {EventMessage} from 'sentry/components/events/eventMessage';
import {HighlightsIconSummary} from 'sentry/components/events/highlights/highlightsIconSummary';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {EventTagView} from 'sentry/components/seer/markdown/embeds/components/event/eventViews/tag';
import {EventTagsView} from 'sentry/components/seer/markdown/embeds/components/event/eventViews/tags';
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
import {makeEventPathname, makeIssueDistributionsPathname} from './eventPathnames';

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
  tagKeys,
  event,
  issueId,
  organization,
  distributionsHref,
}: {
  distributionsHref: string;
  event: Event;
  issueId: string;
  organization: Organization;
  tagKeys: string[] | undefined;
  view: EventData['view'];
}) {
  switch (view) {
    case 'tags':
      return <EventTagsView event={event} distributionsHref={distributionsHref} />;
    case 'tag':
      // `tagKeys` is required for this view; the caller already fell back to the
      // summary when it is missing or empty, so this is unreachable in practice.
      return tagKeys?.length ? (
        <EventTagView
          issueId={issueId}
          organization={organization}
          tagKeys={tagKeys}
          distributionsHref={distributionsHref}
        />
      ) : null;
    case 'summary':
    default:
      return null;
  }
}

export default function SeerEventBlock({id, issueId, shortId, view, tagKeys}: EventData) {
  const organization = useOrganization();
  // A `tag` view without tag keys has nothing to break down -- show the summary.
  const resolvedView = view === 'tag' && !tagKeys?.length ? 'summary' : view;
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
              tagKeys={tagKeys}
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
