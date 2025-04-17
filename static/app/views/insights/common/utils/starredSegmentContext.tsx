import {createContext, useContext, useMemo, useState} from 'react';

export type StarredSegmentContextProps = {
  setInitialStarredSegments: (starredSegments: string[]) => void;
  starredSegments: string[];
  startSegment: (segmentName: string) => void;
  unstarSegment: (segmentName: string) => void;
};

/**
 * Prefer using `useOnboardingContext` hook instead of directly using this context.
 */
export const StarredSegmentContext = createContext<StarredSegmentContextProps>({
  starredSegments: [],
  setInitialStarredSegments: () => {},
  startSegment: () => {},
  unstarSegment: () => {},
});

type ProviderProps = {
  children: React.ReactNode;
};

export function StarredTransactionContextProvider({children, value}: ProviderProps) {
  const [starredTransactions, setStarredTransactions] = useState(
    value?.starredTransactions
  );

  const contextValue = useMemo(
    () => ({
      starredTransactions: starredTransactions?.starredTransactions,
      setStarredTransactions: (starred: string[]) => {
        // If platform is undefined, remove the item from session storage
        if (starredTransactions === undefined) {
          removeStarredTransactions();
        } else {
          setStarredTransactions(starred);
        }
      },
    }),
    [starredTransactions, setStarredTransactions, removeStarredTransactions]
  );

  return (
    <StarredTransactionContext value={contextValue}>{children}</StarredTransactionContext>
  );
}

/**
 * Custom hook to access and update the selected SDK in the onboarding process.
 */
export function useStarredTransactionContext() {
  return useContext(StarredTransactionContext);
}
