import {useCallback, useState} from 'react';
import * as Sentry from '@sentry/react';
import {
  CancelledError,
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

const MAX_EXPORT_SPANS = 50_000;

type ConversationInfiniteData = InfiniteData<
  ApiResponse<ConversationApiResponse>,
  ParsedHeader | undefined
>;

interface ConversationExport {
  markdown: string;
  title: string | null;
}

export interface UseExportConversationResult {
  copyConversation: () => void;
  downloadConversation: () => void;
  isExporting: boolean;
}

export function useExportConversation(
  conversation: UseConversationsOptions
): UseExportConversationResult {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const [isExporting, setIsExporting] = useState(false);

  const runExport = useCallback(
    async (deliver: (result: ConversationExport) => void | Promise<void>) => {
      const options = getConversationQueryOptions(organization, conversation, selection);

      const toExport = (
        data: InfiniteData<ApiResponse<ConversationApiResponse>>
      ): ConversationExport => {
        const spans = data.pages.flatMap(page => page.json.spans ?? []);
        const nodes = buildConversationNodes(spans).nodes;
        return {
          markdown: messagesToMarkdown(extractMessagesFromNodes(nodes)),
          title: data.pages[0]?.json.title ?? null,
        };
      };

      const cached = queryClient.getQueryData(options.queryKey) as
        | ConversationInfiniteData
        | undefined;
      const lastPage = cached?.pages.at(-1);
      const fullyCached =
        !!lastPage &&
        !options.getNextPageParam(
          lastPage,
          cached!.pages,
          cached!.pageParams.at(-1),
          cached!.pageParams
        );

      // Fast path: everything is cached, so deliver within the user gesture
      // (no await first) to keep clipboard/download activation.
      if (fullyCached) {
        await deliver(toExport(cached!));
        return;
      }

      const exportQueryKey = [
        options.queryKey[0],
        options.queryKey[1],
        {...options.queryKey[2], export: true},
      ] as unknown as typeof options.queryKey;

      await queryClient.cancelQueries({queryKey: exportQueryKey});
      queryClient.removeQueries({queryKey: exportQueryKey});

      const observer = new InfiniteQueryObserver(queryClient, {
        ...options,
        queryKey: exportQueryKey,
        initialData: cached,
      });

      setIsExporting(true);
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

        observer.destroy();
        setIsExporting(false);
        if (result.data) {
          await deliver(toExport(result.data));
        }
      } catch (error) {
        observer.destroy();
        setIsExporting(false);
        if (error instanceof CancelledError) {
          return;
        }
        Sentry.captureException(error);
        addErrorMessage(t('Failed to export transcript'));
      }
    },
    [queryClient, organization, conversation, selection]
  );

  const copyConversation = useCallback(
    () =>
      void runExport(async ({markdown}) => {
        trackAnalytics('conversations.detail.copy-conversation', {organization});
        await copyToClipboard(markdown, {
          successMessage: t('Copied transcript to clipboard'),
          errorMessage: t('Failed to copy transcript. Try downloading instead.'),
        });
      }),
    [runExport, organization]
  );

  const downloadConversation = useCallback(
    () =>
      void runExport(({markdown, title}) => {
        trackAnalytics('conversations.detail.export-conversation', {organization});
        downloadTextFile(
          buildExportFilename(title, conversation.conversationId, 'md'),
          markdown,
          'text/markdown'
        );
        addSuccessMessage(t('Transcript exported'));
      }),
    [runExport, organization, conversation.conversationId]
  );

  return {copyConversation, downloadConversation, isExporting};
}
