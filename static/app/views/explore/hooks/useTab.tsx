import {useCallback, useMemo} from 'react';

import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useQueryParamsMode} from 'sentry/views/explore/queryParams/context';
import {updateNullableLocation} from 'sentry/views/explore/queryParams/location';
import {getTargetWithReadableQueryParams} from 'sentry/views/explore/spans/spansQueryParams';

const SPANS_TABLE_KEY = 'table';

export enum Tab {
  SPAN = 'span',
  TRACE = 'trace',
  ATTRIBUTE_BREAKDOWNS = 'attribute_breakdowns',
}

export function useTab(): [Mode | Tab, (tab: Mode | Tab) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = useQueryParamsMode();

  const table = decodeScalar(location.query[SPANS_TABLE_KEY]);

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

      updateNullableLocation(
        target,
        SPANS_TABLE_KEY,
        newTab === Tab.TRACE
          ? 'trace'
          : newTab === Tab.ATTRIBUTE_BREAKDOWNS
            ? 'attribute_breakdowns'
            : null
      );

      navigate(target);
    },
    [location, navigate]
  );

  return [tab, setTab];
}
