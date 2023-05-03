import {createContext, useContext, useState} from 'react';

import {SpanOperationBreakdownFilter} from 'sentry/views/performance/transactionSummary/filter';

const OpBreakdownFilterContext = createContext<{
  opBreakdownFilter: SpanOperationBreakdownFilter;
  setOpBreakdownFilter: (filter: SpanOperationBreakdownFilter) => void;
}>({
  opBreakdownFilter: SpanOperationBreakdownFilter.None,
  setOpBreakdownFilter: (_: SpanOperationBreakdownFilter) => {},
});

export function OpBreakdownFilterProvider({
  filter,
  children,
}: {
  children: React.ReactNode;
  filter?: SpanOperationBreakdownFilter;
}) {
  const [opBreakdownFilter, setOpBreakdownFilter] = useState(filter);
  return (
    <OpBreakdownFilterContext.Provider
      value={{
        opBreakdownFilter: opBreakdownFilter ?? SpanOperationBreakdownFilter.None,
        setOpBreakdownFilter,
      }}
    >
      {children}
    </OpBreakdownFilterContext.Provider>
  );
}

export const useOpBreakdownFilter = () => useContext(OpBreakdownFilterContext);
