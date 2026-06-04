import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useRef, useState} from 'react';

import {
  getFeedbackItemApiOptions,
  type FeedbackItemApiOptions,
} from 'sentry/components/feedback/getFeedbackItemApiOptions';
import {
  useFeedbackListApiOptions,
  useFeedbackListInfiniteApiOptions,
} from 'sentry/components/feedback/useFeedbackListApiOptions';
import type {Organization} from 'sentry/types/organization';

interface Props {
  children: ReactNode;
  organization: Organization;
}

type FeedbackListApiOptions = ReturnType<typeof useFeedbackListApiOptions>;
type FeedbackListInfiniteApiOptions = ReturnType<
  typeof useFeedbackListInfiniteApiOptions
>;

interface TContext {
  getItemApiOptions: (id: string) => FeedbackItemApiOptions;
  listApiOptions: FeedbackListInfiniteApiOptions;
  listHeadTime: number;
  listPrefetchApiOptions: FeedbackListApiOptions;
  resetListHeadTime: () => void;
}

const FeedbackApiOptionsProvider = createContext<TContext | null>(null);

export function FeedbackApiOptions({children, organization}: Props) {
  const [listHeadTime, setHeadTimeMs] = useState(() => Date.now());
  const resetListHeadTime = useCallback(() => {
    setHeadTimeMs(Date.now());
  }, []);

  const itemApiOptionsRef = useRef(new Map<string, FeedbackItemApiOptions>());
  const getItemApiOptions = useCallback(
    (feedbackId: string) => {
      if (!itemApiOptionsRef.current.has(feedbackId)) {
        itemApiOptionsRef.current.set(
          feedbackId,
          getFeedbackItemApiOptions({feedbackId, organization})
        );
      }
      return itemApiOptionsRef.current.get(feedbackId)!;
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
        getItemApiOptions,
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
