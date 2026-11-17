import {useCallback, useRef, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useOrganization} from 'sentry/utils/useOrganization';

import {
  getConversationSpanSearchQueryOptions,
  type UseConversationsOptions,
} from './useConversation';

type ConversationSpanSearchState =
  | {status: 'idle'}
  | {query: string; status: 'searching' | 'no-match' | 'error'}
  | {query: string; spanId: string; status: 'match'};

interface UseConversationSpanSearchOptions {
  conversation: UseConversationsOptions;
  onMatch: (spanId: string) => void;
}

export function useConversationSpanSearch({
  conversation,
  onMatch,
}: UseConversationSpanSearchOptions) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const queryClient = useQueryClient();
  const [state, setState] = useState<ConversationSpanSearchState>({status: 'idle'});
  const latestQueryRef = useRef<string | null>(null);

  const search = useCallback(
    async (query: string) => {
      latestQueryRef.current = query;
      setState({status: 'searching', query});
      try {
        const response = await queryClient.fetchQuery(
          getConversationSpanSearchQueryOptions(
            organization,
            conversation,
            selection,
            query
          )
        );
        // A newer search or a clear supersedes this one.
        if (latestQueryRef.current !== query) {
          return;
        }
        const match = response.json.match;
        if (!match) {
          setState({status: 'no-match', query});
          return;
        }
        setState({status: 'match', query, spanId: match.spanId});
        onMatch(match.spanId);
      } catch {
        if (latestQueryRef.current === query) {
          setState({status: 'error', query});
        }
      }
    },
    [conversation, onMatch, organization, queryClient, selection]
  );

  const clear = useCallback(() => {
    latestQueryRef.current = null;
    setState({status: 'idle'});
  }, []);

  return {state, search, clear};
}
