import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import {AggregationKey} from 'sentry/utils/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {SpanIndexedField} from 'sentry/views/insights/types';

interface Options {
  location: Location;
  navigate: ReturnType<typeof useNavigate>;
}

// TODO: Extend the two lists below with more options upon backend support
export const ALLOWED_VISUALIZE_FIELDS: SpanIndexedField[] = [
  SpanIndexedField.SPAN_DURATION,
];

export const ALLOWED_VISUALIZE_AGGREGATES: AggregationKey[] = [AggregationKey.COUNT];

export const DEFAULT_VISUALIZATION = `${ALLOWED_VISUALIZE_AGGREGATES[0]}(${ALLOWED_VISUALIZE_FIELDS[0]})`;

export function useVisualize(): [string, (visualize: string) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const options = {location, navigate};

  return useVisualizeImpl(options);
}

function useVisualizeImpl({
  location,
  navigate,
}: Options): [string, (visualize: string) => void] {
  const visualize: string | undefined = useMemo(() => {
    return decodeScalar(location.query.visualize) ?? DEFAULT_VISUALIZATION;
  }, [location.query.visualize]);

  const setVisualize = useCallback(
    (newVisualize: string) => {
      navigate({
        ...location,
        query: {
          ...location.query,
          visualize: newVisualize,
        },
      });
    },
    [location, navigate]
  );

  return [visualize, setVisualize];
}
