import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useRef, useState} from 'react';

import getFeedbackItemQueryKey from 'sentry/components/feedback/getFeedbackItemQueryKey';
import useFeedbackListQueryKey from 'sentry/components/feedback/useFeedbackListQueryKey';
import type {Organization} from 'sentry/types/organization';

interface Props {
  children: ReactNode;
  organization: Organization;
}

type ListQueryKey = ReturnType<typeof useFeedbackListQueryKey>;
type ItemQueryKeys = ReturnType<typeof getFeedbackItemQueryKey>;

interface TContext {
  getItemQueryKeys: (id: string) => ItemQueryKeys;
  listHeadTime: number;
  listPrefetchQueryKey: ListQueryKey;
  listQueryKey: ListQueryKey;
  resetListHeadTime: () => void;
}

const EMPTY_ITEM_QUERY_KEYS = {issueQueryKey: undefined, eventQueryKey: undefined};

const DEFAULT_CONTEXT: TContext = {
  getItemQueryKeys: () => EMPTY_ITEM_QUERY_KEYS,
  listHeadTime: 0,
  listPrefetchQueryKey: undefined,
  listQueryKey: undefined,
  resetListHeadTime: () => undefined,
};

const FeedbackQueryKeysProvider = createContext<TContext>(DEFAULT_CONTEXT);

export function FeedbackQueryKeys({children, organization}: Props) {
  // The "Head time" is the timestamp of the newest feedback that we can show in
  // the list (the head element in the array); the same time as when we loaded
  // the page. It can be updated without loading the page, when we want to see
  // fresh list items.
  const [listHeadTime, setHeadTimeMs] = useState(() => Date.now());
  const resetListHeadTime = useCallback(() => {
    setHeadTimeMs(Date.now());
  }, []);

  const itemQueryKeyRef = useRef<Map<string, ItemQueryKeys>>(new Map());
  const getItemQueryKeys = useCallback(
    (feedbackId: string) => {
      if (feedbackId && !itemQueryKeyRef.current.has(feedbackId)) {
        itemQueryKeyRef.current.set(
          feedbackId,
          getFeedbackItemQueryKey({feedbackId, organization})
        );
      }
      return itemQueryKeyRef.current.get(feedbackId) ?? EMPTY_ITEM_QUERY_KEYS;
    },
    [organization]
  );

  const listQueryKey = useFeedbackListQueryKey({
    listHeadTime,
    organization,
    prefetch: false,
  });

  const listPrefetchQueryKey = useFeedbackListQueryKey({
    listHeadTime,
    organization,
    prefetch: true,
  });

  return (
    <FeedbackQueryKeysProvider.Provider
      value={{
        getItemQueryKeys,
        listHeadTime,
        listPrefetchQueryKey,
        listQueryKey,
        resetListHeadTime,
      }}
    >
      {children}
    </FeedbackQueryKeysProvider.Provider>
  );
}

export default function useFeedbackQueryKeys() {
  return useContext(FeedbackQueryKeysProvider);
}
