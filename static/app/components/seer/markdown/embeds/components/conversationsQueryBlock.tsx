import {useQuery} from '@tanstack/react-query';

import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {Count} from 'sentry/components/count';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {PerformanceDuration} from 'sentry/components/performanceDuration';
import {QueryEmbedCard} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedCard';
import {QUERY_EMBED_ROW_LIMIT} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedConstants';
import {
  QueryEmbedTable,
  type QueryEmbedColumn,
} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedTable';
import {toPageFilters} from 'sentry/components/seer/markdown/embeds/components/queryEmbedParams';
import {IconChat} from 'sentry/icons';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {markdownToPlainText} from 'sentry/utils/marked/marked';
import {ellipsize} from 'sentry/utils/string/ellipsize';
import {isUUID} from 'sentry/utils/string/isUUID';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  Conversation,
  ConversationUser,
} from 'sentry/views/explore/conversations/hooks/useConversations';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';

import {getConversationHref} from './conversation/conversationLink';
import {
  combineAgentQuery,
  getConversationsQueryHref,
  getConversationsQueryTitle,
  type ConversationsQueryData,
} from './conversationsQueryLink';

/**
 * The list endpoint's raw rows. `useConversations` flattens the two content
 * fields before handing them out, and this block calls the endpoint directly
 * (that hook takes its filters from the router), so it flattens them itself.
 */
type ConversationApiRow = Omit<Conversation, 'firstInput' | 'lastOutput'> & {
  firstInput?: Array<{text: string; type: string}> | string | null;
  lastOutput?: Array<{text: string; type: string}> | string | null;
};

/** A preview line is one table cell wide, so it is cut well short of the table's limit. */
const PREVIEW_MAX_CHARS = 200;

function flattenContent(content: ConversationApiRow['firstInput']): string | null {
  if (typeof content === 'string') {
    return content;
  }
  return content?.find(part => part.type === 'text')?.text ?? null;
}

/**
 * A title is model-written markdown and a first input is whatever the user
 * typed, so both are flattened to a single line before they go in a cell.
 */
function getConversationLabel(row: ConversationApiRow): string | null {
  const raw = row.title ?? flattenContent(row.firstInput);
  if (!raw) {
    return null;
  }
  const plainText = ellipsize(
    markdownToPlainText(raw).replace(/\s+/g, ' ').trim(),
    PREVIEW_MAX_CHARS
  );
  return plainText.length > 0 ? plainText : null;
}

/** `useConversations` renders the SDK's literal "none" as no user at all. */
function getUserLabel(user: ConversationUser | null): string | null {
  const fields = [user?.email, user?.username, user?.ip_address, user?.id];
  return fields.find(value => value && value.toLowerCase() !== 'none') ?? null;
}

/** A row carries epoch milliseconds; the detail URL wants ISO timestamps. */
function toIsoTimestamp(timestamp: number | null | undefined): string | undefined {
  return timestamp ? new Date(timestamp).toISOString() : undefined;
}

function getConversationIdLabel(conversationId: string): string {
  // UUIDs are long and opaque, so show a short prefix; other id formats
  // (e.g. `resp_...`, `slack:1234`) are already short enough.
  return isUUID(conversationId) ? conversationId.slice(0, 8) : conversationId;
}

/**
 * Opens in a new tab so following a row cannot replace the page the embed is
 * rendered into -- the answer above it would be lost. `getConversationHref`
 * builds the same detail URL the `conversation` embed links to.
 */
function ConversationCell({row}: {row: ConversationApiRow}) {
  const organization = useOrganization();
  const label = getConversationLabel(row);
  const user = getUserLabel(row.user);

  return (
    <Stack gap="xs" minWidth={0}>
      <Text ellipsis>
        <ExternalLink
          href={getConversationHref(
            {
              id: row.conversationId,
              start: toIsoTimestamp(row.startTimestamp),
              end: toIsoTimestamp(row.endTimestamp),
              projects: row.projectId === null ? undefined : [String(row.projectId)],
            },
            organization.slug,
            'seer-conversations-query-embed'
          )}
        >
          {label ?? t('Untitled conversation')}
        </ExternalLink>
      </Text>
      <Flex gap="sm" minWidth={0}>
        <Text size="sm" variant="muted" ellipsis>
          {getConversationIdLabel(row.conversationId)}
        </Text>
        {user ? (
          <Text size="sm" variant="muted" ellipsis>
            {user}
          </Text>
        ) : null}
      </Flex>
    </Stack>
  );
}

const COLUMNS: Array<QueryEmbedColumn<ConversationApiRow>> = [
  {
    key: 'conversation',
    label: t('Conversation'),
    render: row => <ConversationCell row={row} />,
  },
  {
    key: 'duration',
    label: t('Duration'),
    // The generation duration, not the wall-clock span of the conversation:
    // a conversation can sit idle for hours between two messages.
    render: row => (
      <Text ellipsis tabular>
        <PerformanceDuration milliseconds={row.generationDuration} abbreviation />
      </Text>
    ),
  },
  {
    key: 'messages',
    label: t('Messages'),
    render: row => (
      <Text ellipsis tabular>
        <Count value={row.llmCalls} />
      </Text>
    ),
  },
  {
    key: 'errors',
    label: t('Errors'),
    render: row => (
      <Text ellipsis tabular variant={row.errors > 0 ? 'danger' : undefined}>
        <Count value={row.errors} />
      </Text>
    ),
  },
  {
    key: 'cost',
    label: t('Cost'),
    render: row => (
      <Text ellipsis tabular>
        <LLMCosts cost={row.totalCost} />
      </Text>
    ),
  },
];

export default function ConversationsQueryBlock({data}: {data: ConversationsQueryData}) {
  const organization = useOrganization();
  const selection = toPageFilters(data);

  const conversationsQuery = useQuery({
    ...apiOptions.as<ConversationApiRow[]>()(
      '/organizations/$organizationIdOrSlug/agents/conversations/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          query: combineAgentQuery(data.query, data.agents),
          project: selection.projects,
          environment: selection.environments,
          per_page: QUERY_EMBED_ROW_LIMIT,
          ...normalizeDateTimeParams(selection.datetime),
        },
        staleTime: 30_000,
      }
    ),
    retry: false,
  });

  // The endpoint orders by relevance rather than recency; the list view sorts
  // newest-first before rendering, so the preview shows the same five rows.
  const rows = (conversationsQuery.data ?? []).toSorted(
    (a, b) => b.endTimestamp - a.endTimestamp
  );

  return (
    <QueryEmbedCard
      href={getConversationsQueryHref(data, organization)}
      icon={IconChat}
      linkLabel={t('View Conversations')}
      query={data.query}
      testId="seer-conversations-query-embed"
      title={getConversationsQueryTitle(data)}
    >
      <QueryEmbedTable
        columns={COLUMNS}
        emptyMessage={t('No matching conversations')}
        errorMessage={t('Unable to load conversations')}
        isError={conversationsQuery.isError}
        isPending={conversationsQuery.isPending}
        rowKey={row => row.conversationId}
        rows={rows}
      />
    </QueryEmbedCard>
  );
}
