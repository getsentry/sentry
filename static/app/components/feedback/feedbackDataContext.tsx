import {createContext, ReactNode, useContext} from 'react';

import useFeedbackListQueryKey from 'sentry/components/feedback/useFeedbackListQueryKey';
import useFetchFeedbackInfiniteListData, {
  EMPTY_INFINITE_LIST_DATA,
} from 'sentry/components/feedback/useFetchFeedbackInfiniteListData';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  children: ReactNode;
}

const FeedbackListDataContext = createContext<
  ReturnType<typeof useFetchFeedbackInfiniteListData>
>(EMPTY_INFINITE_LIST_DATA);

export function FeedbackDataContext({children}: Props) {
  const organization = useOrganization();
  const queryKey = useFeedbackListQueryKey({organization});
  const contextValue = useFetchFeedbackInfiniteListData({queryKey});

  return (
    <FeedbackListDataContext.Provider value={contextValue}>
      {children}
    </FeedbackListDataContext.Provider>
  );
}

export const useInfiniteFeedbackListData = () => useContext(FeedbackListDataContext);
