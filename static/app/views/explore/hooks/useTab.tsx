import {useCallback, useMemo} from 'react';

import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  useExplorePageParams,
  useSetExploreMode,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {updateLocationWithFields} from 'sentry/views/explore/contexts/pageParamsContext/fields';
import {
  Mode,
  updateLocationWithMode,
} from 'sentry/views/explore/contexts/pageParamsContext/mode';

export enum Tab {
  SPAN = 'span',
  TRACE = 'trace',
}

export function useTab(): [Mode | Tab, (tab: Mode | Tab) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const pageParams = useExplorePageParams();
  const setMode = useSetExploreMode();

  const tab: Mode | Tab = useMemo(() => {
    // HACK: This is pretty gross but to not break anything in the
    // short term, we avoid introducing/removing any fields on the
    // query. So we continue using the existing `mode` value and
    // coalesce it with the `tab` value` to create a single tab.
    if (pageParams.mode === Mode.AGGREGATE) {
      return Mode.AGGREGATE;
    }

    const rawTab = decodeScalar(location.query.table);
    if (rawTab === 'trace') {
      return Tab.TRACE;
    }
    return Tab.SPAN;
  }, [location.query.table, pageParams.mode]);

  const setTab = useCallback(
    (newTab: Mode | Tab) => {
      if (newTab === Mode.AGGREGATE) {
        setMode(Mode.AGGREGATE);
        return;
      }

      if (newTab === Mode.SAMPLES) {
        newTab = Tab.SPAN;
      }

      const target = {
        ...location,
        query: {
          ...location.query,
          table: newTab,
          cursor: undefined,
        },
      };

      // when switching tabs, we should land in samples mode
      updateLocationWithMode(target, Mode.SAMPLES);

      // When switching from the aggregates to samples mode, carry
      // over any group bys as they are helpful context when looking
      // for examples.
      if (pageParams.groupBys.some(groupBy => groupBy !== '')) {
        const fields = [...pageParams.fields];
        for (const groupBy of pageParams.groupBys) {
          if (groupBy !== '' && !fields.includes(groupBy)) {
            fields.push(groupBy);
          }
        }
        updateLocationWithFields(target, fields);
      }

      navigate(target);
    },
    [location, navigate, pageParams, setMode]
  );

  return [tab, setTab];
}
