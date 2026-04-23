import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useRef, useState} from 'react';

import {getFeedbackItemQueryKey} from 'sentry/components/feedback/getFeedbackItemQueryKey';
import {
  useFeedbackListApiOptions,
  useFeedbackListInfiniteApiOptions,
} from 'sentry/components/feedback/useFeedbackListApiOptions';
import type {Organization} from 'sentry/types/organization';
import type {ApiQueryKey} from 'sentry/utils/queryClient';

interface Props {
  children: ReactNode;
  organization: Organization;
}

type ItemQueryKeys = {
  eventQueryKey: ApiQueryKey | undefined;
  issueQueryKey: ApiQueryKey | undefined;
};

type FeedbackListApiOptions = ReturnType<typeof useFeedbackListApiOptions>;
type FeedbackListInfiniteApiOptions = ReturnType<
  typeof useFeedbackListInfiniteApiOptions
>;

interface TContext {
  getItemQueryKeys: (id: string) => ItemQueryKeys;
  listApiOptions: FeedbackListInfiniteApiOptions;
  listHeadTime: number;
  listPrefetchApiOptions: FeedbackListApiOptions;
  resetListHeadTime: () => void;
}

const EMPTY_ITEM_QUERY_KEYS = {issueQueryKey: undefined, eventQueryKey: undefined};

const FeedbackApiOptionsProvider = createContext<TContext | null>(null);

export function FeedbackApiOptions({children, organization}: Props) {
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

  const listApiOptions = useFeedbackListInfiniteApiOptions({
    listHeadTime,
    organization,
    prefetch: false,
  });

  const listPrefetchApiOptions = useFeedbackListApiOptions({
    listHeadTime,
    organization,
    prefetch: true,
  });

  return (
    <FeedbackApiOptionsProvider.Provider
      value={{
        getItemQueryKeys,
        listHeadTime,
        listPrefetchApiOptions,
        listApiOptions,
        resetListHeadTime,
      }}
    >
      {children}
    </FeedbackApiOptionsProvider.Provider>
  );
}

export function useFeedbackApiOptions() {
  const context = useContext(FeedbackApiOptionsProvider);

  if (!context) {
    throw new Error(
      'useFeedbackApiOptions must be used within a FeedbackApiOptionsProvider'
    );
  }

  return context;
}
