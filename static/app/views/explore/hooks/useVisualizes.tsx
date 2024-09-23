import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import {defined} from 'sentry/utils';
import {parseFunction} from 'sentry/utils/discover/fields';
import {
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  ALLOWED_EXPLORE_VISUALIZE_FIELDS,
} from 'sentry/utils/fields';
import {decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {ChartType} from 'sentry/views/insights/common/components/chart';

export type Visualize = {
  chartType: ChartType;
  yAxes: string[];
};

interface Options {
  location: Location;
  navigate: ReturnType<typeof useNavigate>;
}

export const DEFAULT_VISUALIZATION = `${ALLOWED_EXPLORE_VISUALIZE_AGGREGATES[0]}(${ALLOWED_EXPLORE_VISUALIZE_FIELDS[0]})`;

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

    return result.length
      ? result
      : [{yAxes: [DEFAULT_VISUALIZATION], chartType: ChartType.LINE}];
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
    if (yAxes.length <= 0) {
      return null;
    }

    let chartType = Number(parsed.chartType);
    if (isNaN(chartType) || !Object.values(ChartType).includes(chartType)) {
      chartType = ChartType.LINE;
    }

    return {yAxes, chartType};
  } catch (error) {
    return null;
  }
}
