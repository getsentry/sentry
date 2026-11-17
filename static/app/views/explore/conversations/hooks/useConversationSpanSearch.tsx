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
  | {index: number; query: string; spanIds: string[]; status: 'match'; total: number};

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

  const step = useCallback(
    (direction: 1 | -1) => {
      if (state.status !== 'match') {
        return;
      }
      const count = state.spanIds.length;
      const index = (state.index + direction + count) % count;
      setState({...state, index});
      onMatch(state.spanIds[index]!);
    },
    [onMatch, state]
  );

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
        const {matches, total} = response.json;
        if (matches.length === 0) {
          setState({status: 'no-match', query});
          return;
        }
        const spanIds = matches.map(match => match.spanId);
        setState({status: 'match', query, spanIds, total, index: 0});
        onMatch(spanIds[0]!);
      } catch {
        if (latestQueryRef.current === query) {
          setState({status: 'error', query});
        }
      }
    },
    [conversation, onMatch, organization, queryClient, selection]
  );

  const submit = useCallback(
    (query: string, backwards: boolean) => {
      if (state.status === 'match' && state.query === query) {
        step(backwards ? -1 : 1);
        return;
      }
      search(query);
    },
    [search, state, step]
  );

  const clear = useCallback(() => {
    latestQueryRef.current = null;
    setState({status: 'idle'});
  }, []);

  return {
    state,
    submit,
    clear,
    next: () => step(1),
    previous: () => step(-1),
  };
}
