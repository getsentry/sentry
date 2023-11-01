import {createContext, ReactNode, useCallback, useContext, useRef} from 'react';

import getFeedbackItemQueryKey from 'sentry/components/feedback/getFeedbackItemQueryKey';
import useFeedbackListQueryKey from 'sentry/components/feedback/useFeedbackListQueryKey';
import type {Organization} from 'sentry/types';

interface Props {
  children: ReactNode;
  organization: Organization;
}

type ListQueryKey = ReturnType<typeof useFeedbackListQueryKey>;
type ItemQueryKeys = ReturnType<typeof getFeedbackItemQueryKey>;

interface TContext {
  getItemQueryKeys: (id: string) => ItemQueryKeys;
  getListQueryKey: () => ListQueryKey;
}

const EMPTY_ITEM_QUERY_KEYS = {issueQueryKey: undefined, eventQueryKey: undefined};

const DEFAULT_CONTEXT: TContext = {
  getItemQueryKeys: () => EMPTY_ITEM_QUERY_KEYS,
  getListQueryKey: () => [''],
};

const FeedbackQueryKeysProvider = createContext<TContext>(DEFAULT_CONTEXT);

export function FeedbackQueryKeys({children, organization}: Props) {
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

  const listQueryKey = useFeedbackListQueryKey({organization});
  const getListQueryKey = useCallback(() => listQueryKey, [listQueryKey]);

  return (
    <FeedbackQueryKeysProvider.Provider
      value={{
        getItemQueryKeys,
        getListQueryKey,
      }}
    >
      {children}
    </FeedbackQueryKeysProvider.Provider>
  );
}

export default function useFeedbackQueryKeys() {
  return useContext(FeedbackQueryKeysProvider);
}
