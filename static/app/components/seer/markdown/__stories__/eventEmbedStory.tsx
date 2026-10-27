import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {groupEventApiOptions} from 'sentry/views/issueDetails/utils';

import {EmbedStory, EmbedVariant} from './embedStory';

/**
 * Tag keys worth breaking down in the `tag` view. An event holds one value per
 * tag, so the story wants keys whose values actually vary across the issue --
 * `browser` reads better than `level`, which is the same on nearly every event.
 */
const STORY_TAG_KEYS = ['browser', 'os', 'device', 'release', 'url', 'environment'];

/** How many keys the multi-tag variant asks for. */
const STORY_TAG_KEY_COUNT = 3;

function recentIssueApiOptions(organizationSlug: string) {
  return apiOptions.as<Group[]>()('/organizations/$organizationIdOrSlug/issues/', {
    path: {organizationIdOrSlug: organizationSlug},
    query: {
      project: '-1',
      statsPeriod: '14d',
      query: 'is:unresolved issue.category:error',
      // By frequency, so the issue picked has enough events for its tags to
      // have a distribution worth rendering.
      sort: 'freq',
      limit: 1,
    },
    staleTime: 0,
  });
}

function getStoryTagKeys(event: Event): string[] {
  const tagKeys = new Set(event.tags?.map(tag => tag.key));
  const preferred = STORY_TAG_KEYS.filter(key => tagKeys.has(key));
  // Fall back to whatever the event does carry, so an event with no tag in the
  // preferred list still demonstrates the view.
  const keys = preferred.length ? preferred : (event.tags?.map(tag => tag.key) ?? []);
  return keys.slice(0, STORY_TAG_KEY_COUNT);
}

export function EventEmbedStory() {
  const organization = useOrganization();
  const issueQuery = useQuery(recentIssueApiOptions(organization.slug));
  const issue = issueQuery.data?.[0];

  // The embed takes an event ID, which the issue list does not return, so
  // resolve the issue's latest event. `environments` is deliberately empty,
  // matching the embed itself.
  const eventQuery = useQuery({
    ...groupEventApiOptions({
      orgSlug: organization.slug,
      groupId: issue?.id ?? '',
      eventId: 'latest',
      environments: [],
    }),
    enabled: Boolean(issue),
    retry: false,
  });
  const event = eventQuery.data;

  const isPending = issueQuery.isPending || (Boolean(issue) && eventQuery.isPending);
  const isError = issueQuery.isError || eventQuery.isError;
  const data =
    issue && event
      ? {id: event.id, issueId: issue.id, shortId: issue.shortId}
      : undefined;
  const tagKeys = event ? getStoryTagKeys(event) : [];

  return (
    <EmbedStory name="event">
      {isPending ? (
        <LoadingIndicator />
      ) : isError ? (
        <Text variant="muted">Unable to load an event example.</Text>
      ) : data ? (
        <Fragment>
          <EmbedVariant name="event" label="Event" data={data} />
          <EmbedVariant name="event" label="All tags" data={{...data, view: 'tags'}} />
          {tagKeys.length ? (
            <EmbedVariant
              name="event"
              label={`Single tag breakdown (${tagKeys[0]})`}
              data={{...data, view: 'tag', tagKeys: tagKeys.slice(0, 1)}}
            />
          ) : null}
          {tagKeys.length > 1 ? (
            <EmbedVariant
              name="event"
              label={`Several tag breakdowns (${tagKeys.join(', ')})`}
              data={{...data, view: 'tag', tagKeys}}
            />
          ) : null}
        </Fragment>
      ) : (
        <Text variant="muted">No error event is available for this organization.</Text>
      )}
    </EmbedStory>
  );
}
