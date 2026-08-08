import {startTransition, useId, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {getItemId, listData} from '@react-aria/listbox';
import {ListKeyboardDelegate, useSelectableCollection} from '@react-aria/selection';
import {Item} from '@react-stately/collections';
import {useListState} from '@react-stately/list';

import {getRequestKey, type ActiveMention} from './matching';
import type {MentionSource} from './types';

interface SuggestionListItem<T> {
  hideCheck: true;
  key: string;
  label: React.ReactNode;
  suggestion: T;
  textValue: string;
}

type SuggestionLoadStatus = 'error' | 'idle' | 'loading' | 'ready';

interface SuggestionState<T> {
  items: readonly T[];
  requestKey: string | null;
  status: SuggestionLoadStatus;
}

interface UseMentionSuggestionsOptions<T> {
  activeMention: ActiveMention | null;
  activeSource: MentionSource<T> | undefined;
  inputRef: React.RefObject<HTMLDivElement | null>;
  isOpen: boolean;
  listBoxRef: React.RefObject<HTMLUListElement | null>;
  maxSuggestions: number;
}

const IDLE_SUGGESTIONS = {
  items: [],
  requestKey: null,
  status: 'idle',
} as const;

export function useMentionSuggestions<T>({
  activeMention,
  activeSource,
  inputRef,
  isOpen,
  listBoxRef,
  maxSuggestions,
}: UseMentionSuggestionsOptions<T>) {
  const initializedFocusRequestRef = useRef<string | null>(null);
  const [suggestionState, setSuggestionState] =
    useState<SuggestionState<T>>(IDLE_SUGGESTIONS);
  const activeQuery = activeMention?.query;
  const requestKey = activeSource ? getRequestKey(activeMention) : null;

  useLayoutEffect(() => {
    if (activeQuery === undefined || !activeSource || !requestKey) {
      setSuggestionState(IDLE_SUGGESTIONS);
      return;
    }

    const abortController = new AbortController();
    setSuggestionState({items: [], requestKey, status: 'loading'});

    let suggestions: ReturnType<MentionSource<T>['getSuggestions']>;
    try {
      suggestions = activeSource.getSuggestions(activeQuery, {
        signal: abortController.signal,
      });
    } catch {
      setSuggestionState({items: [], requestKey, status: 'error'});
      return () => abortController.abort();
    }

    if (Array.isArray(suggestions)) {
      setSuggestionState({
        items: suggestions.slice(0, maxSuggestions),
        requestKey,
        status: 'ready',
      });
      return () => abortController.abort();
    }

    Promise.resolve(suggestions).then(
      items => {
        if (abortController.signal.aborted) {
          return;
        }

        startTransition(() => {
          setSuggestionState({
            items: items.slice(0, maxSuggestions),
            requestKey,
            status: 'ready',
          });
        });
      },
      () => {
        if (!abortController.signal.aborted) {
          setSuggestionState({items: [], requestKey, status: 'error'});
        }
      }
    );

    return () => abortController.abort();
  }, [activeQuery, activeSource, maxSuggestions, requestKey]);

  const currentSuggestions = useMemo(
    () => (suggestionState.requestKey === requestKey ? suggestionState.items : []),
    [requestKey, suggestionState.items, suggestionState.requestKey]
  );
  const status =
    suggestionState.requestKey === requestKey ? suggestionState.status : 'loading';

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
    items,
    listBoxId,
    listState,
    requestKey,
    status,
  };
}
