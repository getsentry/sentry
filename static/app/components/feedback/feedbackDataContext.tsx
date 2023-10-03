import {createContext, ReactNode, useContext} from 'react';

import useFetchFeedbackInfiniteListData, {
  EMPTY_INFINITE_LIST_DATA,
} from 'sentry/components/feedback/useFetchFeedbackInfiniteListData';

type ListDataParams = Parameters<typeof useFetchFeedbackInfiniteListData>[0];
interface ProviderProps extends ListDataParams {
  children: ReactNode;
}

const FeedbackListDataContext = createContext<
  ReturnType<typeof useFetchFeedbackInfiniteListData>
>(EMPTY_INFINITE_LIST_DATA);

export function FeedbackDataContext({children, ...listDataParams}: ProviderProps) {
  const contextValue = useFetchFeedbackInfiniteListData(listDataParams);

  return (
    <FeedbackListDataContext.Provider value={contextValue}>
      {children}
    </FeedbackListDataContext.Provider>
  );
}

export const useInfiniteFeedbackListData = () => useContext(FeedbackListDataContext);
