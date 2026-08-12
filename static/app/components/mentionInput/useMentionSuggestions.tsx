import {useId, useLayoutEffect, useMemo, useRef} from 'react';
import {getItemId, listData} from '@react-aria/listbox';
import {ListKeyboardDelegate, useSelectableCollection} from '@react-aria/selection';
import {Item} from '@react-stately/collections';
import {useListState} from '@react-stately/list';
import {skipToken, useQuery, type QueryStatus} from '@tanstack/react-query';

import {getRequestKey, type ActiveMention} from './matching';
import type {MentionSource} from './types';

interface SuggestionListItem<T> {
  hideCheck: true;
  key: string;
  label: React.ReactNode;
  suggestion: T;
  textValue: string;
}

export type MentionSuggestionStatus = 'empty' | 'error' | 'loading' | 'ready';

interface UseMentionSuggestionsOptions<T> {
  activeMention: ActiveMention | null;
  activeSource: MentionSource<T> | undefined;
  inputRef: React.RefObject<HTMLDivElement | null>;
  isOpen: boolean;
  listBoxRef: React.RefObject<HTMLUListElement | null>;
}

const MAX_SUGGESTIONS = 50;

function useSourceSuggestions<T>(
  source: MentionSource<T> | undefined,
  query: string | undefined
) {
  const queriedSource = source && 'queryOptions' in source ? source : undefined;
  const suggestionsQuery = useQuery(
    queriedSource && query !== undefined
      ? queriedSource.queryOptions(query)
      : {queryKey: ['mention-suggestions'], queryFn: skipToken}
  );
  const suggestions = useMemo(() => {
    if (!source || query === undefined) {
      return [];
    }

    if ('getSuggestions' in source) {
      return source.getSuggestions(query).slice(0, MAX_SUGGESTIONS);
    }

    const queriedSuggestions: readonly T[] | undefined = suggestionsQuery.data;
    return queriedSuggestions?.slice(0, MAX_SUGGESTIONS) ?? [];
  }, [query, source, suggestionsQuery.data]);

  return {
    queryStatus: queriedSource ? suggestionsQuery.status : 'success',
    suggestions,
  };
}

function getSuggestionStatus(
  queryStatus: QueryStatus,
  hasSuggestions: boolean
): MentionSuggestionStatus {
  if (queryStatus === 'pending') {
    return 'loading';
  }

  if (queryStatus === 'error') {
    return 'error';
  }

  return hasSuggestions ? 'ready' : 'empty';
}

export function useMentionSuggestions<T>({
  activeMention,
  activeSource,
  inputRef,
  isOpen,
  listBoxRef,
}: UseMentionSuggestionsOptions<T>) {
  const initializedFocusRequestRef = useRef<string | null>(null);
  const activeQuery = activeMention?.query;
  const requestKey = activeSource ? getRequestKey(activeMention) : null;
  const {suggestions: currentSuggestions, queryStatus} = useSourceSuggestions(
    activeSource,
    activeQuery
  );

  const items = useMemo<ReadonlyArray<SuggestionListItem<T>>>(
    () =>
      currentSuggestions.map(suggestion => ({
        key: `${activeSource?.id ?? 'source'}:${activeSource?.getId(suggestion)}`,
        hideCheck: true,
        label:
          activeSource?.renderSuggestion?.(suggestion) ??
          activeSource?.getText(suggestion),
        suggestion,
        textValue: activeSource?.getText(suggestion) ?? '',
      })),
    [activeSource, currentSuggestions]
  );

  const listState = useListState<SuggestionListItem<T>>({
    items,
    selectionMode: 'none',
    children: item => (
      <Item<SuggestionListItem<T>> {...item} key={item.key}>
        {item.label}
      </Item>
    ),
  });

  const listBoxId = useId();
  listData.set(listState, {id: listBoxId});

  const keyboardDelegate = useMemo(
    () =>
      new ListKeyboardDelegate({
        collection: listState.collection,
        disabledKeys: listState.selectionManager.disabledKeys,
        ref: listBoxRef,
      }),
    [listBoxRef, listState.collection, listState.selectionManager.disabledKeys]
  );
  const {collectionProps} = useSelectableCollection({
    selectionManager: listState.selectionManager,
    keyboardDelegate,
    shouldFocusWrap: true,
    shouldUseVirtualFocus: true,
    disallowTypeAhead: true,
    isVirtualized: true,
    ref: inputRef,
  });

  useLayoutEffect(() => {
    if (!isOpen) {
      initializedFocusRequestRef.current = null;
      listState.selectionManager.setFocusedKey(null);
      return;
    }

    if (
      listState.collection.size === 0 ||
      initializedFocusRequestRef.current === requestKey
    ) {
      return;
    }

    initializedFocusRequestRef.current = requestKey;
    listState.selectionManager.setFocused(true);
    listState.selectionManager.setFocusedKey(listState.collection.getFirstKey());
  }, [isOpen, listState.collection, listState.selectionManager, requestKey]);

  const focusedKey = listState.selectionManager.focusedKey;

  return {
    activeDescendant:
      isOpen && focusedKey !== null ? getItemId(listState, focusedKey) : undefined,
    collectionProps,
    focusedKey,
    getSuggestion: (key: React.Key) => items.find(item => item.key === key)?.suggestion,
    count: items.length,
    listBoxId,
    listState,
    requestKey,
    status: getSuggestionStatus(queryStatus, items.length > 0),
  };
}
