import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import {defined} from 'sentry/utils';
import {parseFunction} from 'sentry/utils/discover/fields';
import {AggregationKey} from 'sentry/utils/fields';
import {decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {SpanIndexedField} from 'sentry/views/insights/types';

export type Visualize = {
  yAxes: string[];
};

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

export function useVisualizes(): [Visualize[], (visualizes: Visualize[]) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const options = {location, navigate};

  return useVisualizesImpl(options);
}

function useVisualizesImpl({
  location,
  navigate,
}: Options): [Visualize[], (visualizes: Visualize[]) => void] {
  const visualizes: Visualize[] = useMemo(() => {
    const rawVisualizes = decodeList(location.query.visualize);

    const result: Visualize[] = rawVisualizes
      .map(parseVisualizes)
      .filter(defined)
      .filter(parsed => parsed.yAxes.length > 0);

    return result.length ? result : [{yAxes: [DEFAULT_VISUALIZATION]}];
  }, [location.query.visualize]);

  const setVisualizes = useCallback(
    (newVisualizes: Visualize[]) => {
      const stringified: string[] = [];
      for (const visualize of newVisualizes) {
        stringified.push(JSON.stringify(visualize));
      }

      navigate({
        ...location,
        query: {
          ...location.query,
          visualize: stringified,
        },
      });
    },
    [location, navigate]
  );

  return [visualizes, setVisualizes];
}

function parseVisualizes(raw: string): Visualize | null {
  try {
    const parsed = JSON.parse(raw);
    if (!defined(parsed) || !Array.isArray(parsed.yAxes)) {
      return null;
    }

    const yAxes = parsed.yAxes.filter(parseFunction);
    if (yAxes.lenth <= 0) {
      return null;
    }

    return {yAxes};
  } catch (error) {
    return null;
  }
}
