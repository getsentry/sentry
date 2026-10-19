import {useCallback, useState} from 'react';
import * as Sentry from '@sentry/react';
import {
  InfiniteQueryObserver,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import type {ParsedHeader} from 'sentry/utils/parseLinkHeader';
import {copyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  buildConversationNodes,
  type ConversationApiResponse,
  getConversationQueryOptions,
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

// Safety ceiling so a pathological conversation cannot paginate indefinitely.
const MAX_EXPORT_SPANS = 50_000;

// The cached infinite-query data for a conversation: one page per response,
// keyed by the Link-header cursor the endpoint returns.
type ConversationInfiniteData = InfiniteData<
  ApiResponse<ConversationApiResponse>,
  ParsedHeader | undefined
>;

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
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const [isExporting, setIsExporting] = useState(false);

  const fetchConversation = useCallback(async (): Promise<ConversationExport> => {
    const options = getConversationQueryOptions(organization, conversation, selection);

    // A distinct query key keeps the export's extra pages out of the display
    // cache, while seeding it from the display's data lets the observer resume
    // where the display left off and fetch only the missing pages. It runs on
    // the app-wide query client, so leaving the transcript tab does not abort
    // it. The cast re-tags the key (same data shape, distinct value).
    const exportQueryKey = [
      options.queryKey[0],
      options.queryKey[1],
      {...options.queryKey[2], export: true},
    ] as unknown as typeof options.queryKey;

    const observer = new InfiniteQueryObserver(queryClient, {
      ...options,
      queryKey: exportQueryKey,
      initialData: queryClient.getQueryData(options.queryKey) as
        | ConversationInfiniteData
        | undefined,
    });

    try {
      let result = observer.getCurrentResult();
      while (!result.data || result.hasNextPage) {
        result = await observer.fetchNextPage({throwOnError: true});
        const loaded =
          result.data?.pages.reduce(
            (total, page) => total + (page.json.spans?.length ?? 0),
            0
          ) ?? 0;
        if (loaded >= MAX_EXPORT_SPANS) {
          break;
        }
      }

      const spans = result.data?.pages.flatMap(page => page.json.spans ?? []) ?? [];
      const title = result.data?.pages[0]?.json.title ?? null;
      const nodes = buildConversationNodes(spans).nodes;
      return {markdown: messagesToMarkdown(extractMessagesFromNodes(nodes)), title};
    } finally {
      observer.destroy();
      queryClient.removeQueries({queryKey: exportQueryKey});
    }
  }, [queryClient, organization, conversation, selection]);

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
