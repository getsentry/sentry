import {useCallback, useMemo} from 'react';

import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  useQueryParamsMode,
  useQueryParamsTable,
  useSetQueryParams,
} from 'sentry/views/explore/queryParams/context';

export enum Tab {
  SPAN = 'span',
  TRACE = 'trace',
  ATTRIBUTE_BREAKDOWNS = 'attribute_breakdowns',
}

export function useTab(): [Mode | Tab, (tab: Mode | Tab) => void] {
  const mode = useQueryParamsMode();
  const table = useQueryParamsTable();
  const setQueryParams = useSetQueryParams();

  const tab: Mode | Tab = useMemo(() => {
    // HACK: This is pretty gross but to not break anything in the
    // short term, we avoid introducing/removing any fields on the
    // query. So we continue using the existing `mode` value and
    // coalesce it with the `tab` value` to create a single tab.
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
      setQueryParams({
        mode: newTab === Mode.AGGREGATE ? Mode.AGGREGATE : Mode.SAMPLES,
        table:
          newTab === Tab.TRACE
            ? 'trace'
            : newTab === Tab.ATTRIBUTE_BREAKDOWNS
              ? 'attribute_breakdowns'
              : newTab === Tab.SPAN
                ? 'span'
                : null,
      });
    },
    [setQueryParams]
  );

  return [tab, setTab];
}
