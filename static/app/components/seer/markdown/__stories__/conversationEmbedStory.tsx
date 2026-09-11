import {useQuery} from '@tanstack/react-query';

import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {Conversation} from 'sentry/views/explore/conversations/hooks/useConversations';

import {EmbedStory, EmbedVariant} from './embedStory';

/** Enough rows to find one with a title without paging the whole list. */
const STORY_CONVERSATION_LIMIT = 25;

/**
 * The schema's `start`/`end` are ISO strings, but a conversation row carries
 * epoch milliseconds.
 */
function toIsoTimestamp(timestamp: number | null | undefined): string | undefined {
  return timestamp ? new Date(timestamp).toISOString() : undefined;
}

/**
 * `useConversations` reads its filters from the router, which a story has no
 * business driving, so the list is fetched directly -- the same call the
 * `conversationsQuery` block makes.
 */
export function ConversationEmbedStory() {
  const organization = useOrganization();
  const {data, isError, isPending} = useQuery({
    ...apiOptions.as<Conversation[]>()(
      '/organizations/$organizationIdOrSlug/agents/conversations/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          project: [ALL_ACCESS_PROJECTS],
          per_page: STORY_CONVERSATION_LIMIT,
          statsPeriod: '14d',
        },
        staleTime: 30_000,
      }
    ),
    retry: false,
  });

  // The endpoint orders by relevance rather than recency, and a titled
  // conversation shows off the embed better than an untitled one.
  const conversations = (data ?? []).toSorted((a, b) => b.endTimestamp - a.endTimestamp);
  const conversation = conversations.find(row => row.title) ?? conversations[0];

  return (
    <EmbedStory name="conversation">
      {isPending ? (
        <LoadingIndicator />
      ) : isError ? (
        <Text variant="muted">Unable to load a conversation example.</Text>
      ) : conversation ? (
        <EmbedVariant
          name="conversation"
          label="Conversation"
          data={{
            id: conversation.conversationId,
            title: conversation.title ?? undefined,
            projects:
              conversation.projectId === null
                ? undefined
                : [String(conversation.projectId)],
            start: toIsoTimestamp(conversation.startTimestamp),
            end: toIsoTimestamp(conversation.endTimestamp),
          }}
        />
      ) : (
        <Text variant="muted">No conversation is available for this organization.</Text>
      )}
    </EmbedStory>
  );
}
