import {useCallback, useState} from 'react';
import * as Sentry from '@sentry/react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {useApi} from 'sentry/utils/useApi';
import {copyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  buildConversationNodes,
  buildConversationQueryParams,
  type ConversationApiResponse,
  type UseConversationsOptions,
} from 'sentry/views/explore/conversations/hooks/useConversation';
import {
  extractMessagesFromNodes,
  messagesToMarkdown,
} from 'sentry/views/explore/conversations/utils/conversationMessages';
import {
  buildExportFilename,
  downloadTextFile,
} from 'sentry/views/explore/conversations/utils/exportConversation';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

// The endpoint maxes out at 1,000 rows per page; a larger page means fewer
// round-trips for this explicit, one-off export than the display's background
// paging uses.
const EXPORT_PER_PAGE = 1000;

// Safety ceiling so a pathological conversation cannot paginate indefinitely.
const MAX_EXPORT_SPANS = 50_000;

interface ConversationExport {
  markdown: string;
  title: string | null;
}

interface UseExportConversationOptions {
  conversation: UseConversationsOptions;
  /**
   * Whether `loadedNodes` already holds the entire conversation. When true the
   * export reuses them directly; otherwise it fetches every page on demand.
   */
  isFullyLoaded: boolean;
  /** Nodes already rendered by the display query. */
  loadedNodes: AITraceSpanNode[];
  /** Conversation title already read by the display query, for the filename. */
  title: string | null;
}

export interface UseExportConversationResult {
  copyConversation: () => void;
  downloadConversation: () => void;
  isExporting: boolean;
}

/**
 * Copies or downloads a conversation's transcript as Markdown. When the display
 * query has already loaded the whole conversation this reuses those nodes with
 * no refetch; otherwise it fetches every page on demand -- independently of the
 * display query, so exporting a large conversation does not bloat the
 * transcript/timeline caches.
 */
export function useExportConversation({
  conversation,
  loadedNodes,
  title: loadedTitle,
  isFullyLoaded,
}: UseExportConversationOptions): UseExportConversationResult {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const [isExporting, setIsExporting] = useState(false);

  const fetchConversation = useCallback(async (): Promise<ConversationExport> => {
    const baseQuery = buildConversationQueryParams(conversation, selection);
    const url = `/organizations/${organization.slug}/agents/conversations/${conversation.conversationId}/`;

    const spans: ConversationApiResponse['spans'] = [];
    let title: string | null = null;
    let cursor: string | undefined;

    do {
      const [data, , resp] = await api.requestPromise(url, {
        includeAllArgs: true,
        query: {...baseQuery, per_page: EXPORT_PER_PAGE, cursor},
      });
      const body = data as ConversationApiResponse;
      if (title === null) {
        title = body.title ?? null;
      }
      spans.push(...(body.spans ?? []));
      const next = parseLinkHeader(resp?.getResponseHeader('Link') ?? null).next;
      cursor = next?.results ? next.cursor : undefined;
    } while (cursor && spans.length < MAX_EXPORT_SPANS);

    const nodes = buildConversationNodes(spans).nodes;
    return {markdown: messagesToMarkdown(extractMessagesFromNodes(nodes)), title};
  }, [api, organization.slug, conversation, selection]);

  // Shared export loop: resolves the transcript (reusing the cache when it holds
  // the whole conversation, otherwise fetching every page) and hands it to
  // `sink`, which performs the copy-vs-download specifics. Spinner and error
  // handling live here so each sink stays a plain action.
  const exportWith = useCallback(
    async (sink: (conversationExport: ConversationExport) => void | Promise<void>) => {
      try {
        if (isFullyLoaded) {
          // Fast path: the whole conversation is already cached, so build the
          // transcript with no network call and no spinner.
          await sink({
            markdown: messagesToMarkdown(extractMessagesFromNodes(loadedNodes)),
            title: loadedTitle,
          });
          return;
        }

        setIsExporting(true);
        addLoadingMessage(t('Loading the full conversation...'));
        await sink(await fetchConversation());
      } catch (error) {
        Sentry.captureException(error);
        addErrorMessage(t('Failed to export transcript'));
      } finally {
        setIsExporting(false);
      }
    },
    [isFullyLoaded, loadedNodes, loadedTitle, fetchConversation]
  );

  const copyConversation = useCallback(
    () =>
      void exportWith(async ({markdown}) => {
        trackAnalytics('conversations.detail.copy-conversation', {organization});
        // copyToClipboard handles its own success/error toast, replacing the
        // loading indicator.
        await copyToClipboard(markdown, {
          successMessage: t('Copied transcript to clipboard'),
          errorMessage: t('Failed to copy transcript. Try downloading instead.'),
        });
      }),
    [exportWith, organization]
  );

  const downloadConversation = useCallback(
    () =>
      void exportWith(({markdown, title}) => {
        trackAnalytics('conversations.detail.export-conversation', {organization});
        downloadTextFile(
          buildExportFilename(title, conversation.conversationId, 'md'),
          markdown,
          'text/markdown'
        );
        addSuccessMessage(t('Transcript exported'));
      }),
    [exportWith, organization, conversation.conversationId]
  );

  return {copyConversation, downloadConversation, isExporting};
}
