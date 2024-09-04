import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import {parseFunction} from 'sentry/utils/discover/fields';
import {AggregationKey} from 'sentry/utils/fields';
import {decodeList} from 'sentry/utils/queryString';
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
  SpanIndexedField.SPAN_SELF_TIME,
];

export const ALLOWED_VISUALIZE_AGGREGATES: AggregationKey[] = [
  AggregationKey.COUNT,
  AggregationKey.MIN,
  AggregationKey.MAX,
  AggregationKey.AVG,
];

export const DEFAULT_VISUALIZATION = `${ALLOWED_VISUALIZE_AGGREGATES[0]}(${ALLOWED_VISUALIZE_FIELDS[0]})`;

export function useVisualizes(): [string[], (visualizes: string[]) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const options = {location, navigate};

  return useVisualizesImpl(options);
}

function useVisualizesImpl({
  location,
  navigate,
}: Options): [string[], (visualizes: string[]) => void] {
  const visualizes: string[] = useMemo(() => {
    let rawVisualizes = decodeList(location.query.visualize);

    if (!rawVisualizes.length) {
      rawVisualizes = [DEFAULT_VISUALIZATION];
    }

    return rawVisualizes.map(rawVisualize =>
      parseFunction(rawVisualize) ? rawVisualize : DEFAULT_VISUALIZATION
    );
  }, [location.query.visualize]);

  const setVisualizes = useCallback(
    (newVisualizes: string[]) => {
      navigate({
        ...location,
        query: {
          ...location.query,
          visualize: newVisualizes,
        },
      });
    },
    [location, navigate]
  );

  return [visualizes, setVisualizes];
}
