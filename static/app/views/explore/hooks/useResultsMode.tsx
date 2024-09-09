import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useGroupBys} from 'sentry/views/explore/hooks/useGroupBys';
import {useSampleFields} from 'sentry/views/explore/hooks/useSampleFields';

interface Options {
  location: Location;
  navigate: ReturnType<typeof useNavigate>;
}

export type ResultMode = 'samples' | 'aggregate';

export function useResultMode(): [ResultMode, (newMode: ResultMode) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const options = {location, navigate};

  return useResultModeImpl(options);
}

function useResultModeImpl({
  location,
  navigate,
}: Options): [ResultMode, (newMode: ResultMode) => void] {
  const [sampleFields] = useSampleFields();
  const [groupBys] = useGroupBys();

  const resultMode: ResultMode = useMemo(() => {
    const rawMode = decodeScalar(location.query.mode);
    if (rawMode === 'aggregate') {
      return 'aggregate' as const;
    }
    return 'samples' as const;
  }, [location.query.mode]);

  const setResultMode = useCallback(
    (newMode: ResultMode) => {
      // When switching from the aggregates to samples mode, carry
      // over any group bys as they are helpful context when looking
      // for examples.
      const fields = [...sampleFields];
      if (newMode === 'samples') {
        for (const groupBy of groupBys) {
          if (groupBy && !fields.includes(groupBy)) {
            fields.push(groupBy);
          }
        }
      }

      navigate({
        ...location,
        query: {
          ...location.query,
          mode: newMode,
          field: fields,
        },
      });
    },
    [location, navigate, sampleFields, groupBys]
  );

  return [resultMode, setResultMode];
}
