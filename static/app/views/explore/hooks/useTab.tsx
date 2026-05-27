import {useCallback, useMemo} from 'react';

import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  useQueryParams,
  useQueryParamsMode,
  useSetQueryParams,
} from 'sentry/views/explore/queryParams/context';

export enum Tab {
  SPAN = 'span',
  TRACE = 'trace',
  ATTRIBUTE_BREAKDOWNS = 'attribute_breakdowns',
}

export function useTab(): [Mode | Tab, (tab: Mode | Tab) => void] {
  const mode = useQueryParamsMode();
  const queryParams = useQueryParams();
  const setQueryParams = useSetQueryParams();

  const table = queryParams.table;

  const tab: Mode | Tab = useMemo(() => {
    if (mode === Mode.AGGREGATE) {
      return Mode.AGGREGATE;
    }

    if (table === 'trace') {
      return Tab.TRACE;
    }
    if (table === 'attribute_breakdowns') {
      return Tab.ATTRIBUTE_BREAKDOWNS;
    }

    return Tab.SPAN;
  }, [table, mode]);

  const setTab = useCallback(
    (newTab: Mode | Tab) => {
      const newMode = newTab === Mode.AGGREGATE ? Mode.AGGREGATE : Mode.SAMPLES;
      const tableValue =
        newTab === Tab.TRACE
          ? 'trace'
          : newTab === Tab.ATTRIBUTE_BREAKDOWNS
            ? 'attribute_breakdowns'
            : null;
      setQueryParams({mode: newMode, table: tableValue});
    },
    [setQueryParams]
  );

  return [tab, setTab];
}
