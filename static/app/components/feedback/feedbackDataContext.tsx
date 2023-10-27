import {createContext, ReactNode, useContext} from 'react';

import getFeedbackListQueryKey from 'sentry/components/feedback/getFeedbackListQueryKey';
import useFeedbackListQueryFromLocation from 'sentry/components/feedback/useFeedbackListQueryFromLocation';
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

  const queryView = useFeedbackListQueryFromLocation();
  const queryKey = getFeedbackListQueryKey({organization, queryView});
  const contextValue = useFetchFeedbackInfiniteListData({queryKey});

  return (
    <FeedbackListDataContext.Provider value={contextValue}>
      {children}
    </FeedbackListDataContext.Provider>
  );
}

export const useInfiniteFeedbackListData = () => useContext(FeedbackListDataContext);
