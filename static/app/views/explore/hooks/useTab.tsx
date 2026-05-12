import {useCallback, useMemo} from 'react';
import {parseAsString, useQueryState} from 'nuqs';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useQueryParamsMode} from 'sentry/views/explore/queryParams/context';
import {getTargetWithReadableQueryParams} from 'sentry/views/explore/spans/spansQueryParams';

export enum Tab {
  SPAN = 'span',
  TRACE = 'trace',
  ATTRIBUTE_BREAKDOWNS = 'attribute_breakdowns',
}

export function useTab(): [Mode | Tab, (tab: Mode | Tab) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = useQueryParamsMode();

  const [table, setTable] = useQueryState('table', parseAsString);

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
      const target = getTargetWithReadableQueryParams(location, {
        mode: newTab === Mode.AGGREGATE ? Mode.AGGREGATE : Mode.SAMPLES,
      });

      setTable(
        newTab === Tab.TRACE
          ? 'trace'
          : newTab === Tab.ATTRIBUTE_BREAKDOWNS
            ? 'attribute_breakdowns'
            : null
      );

      navigate(target);
    },
    [location, navigate, setTable]
  );

  return [tab, setTab];
}
