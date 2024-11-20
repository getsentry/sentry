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

export const MAX_VISUALIZES = 4;

type BaseVisualize = {
  chartType: ChartType;
  yAxes: string[];
};

export type Visualize = BaseVisualize & {
  label: string;
};

interface Options {
  location: Location;
  navigate: ReturnType<typeof useNavigate>;
}

export const DEFAULT_VISUALIZATION = `${ALLOWED_EXPLORE_VISUALIZE_AGGREGATES[0]}(${ALLOWED_EXPLORE_VISUALIZE_FIELDS[0]})`;

export function useVisualizes(): [Visualize[], (visualizes: BaseVisualize[]) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const options = {location, navigate};

  return useVisualizesImpl(options);
}

function useVisualizesImpl({
  location,
  navigate,
}: Options): [Visualize[], (visualizes: BaseVisualize[]) => void] {
  const visualizes: Visualize[] = useMemo(() => {
    const rawVisualizes = decodeList(location.query.visualize);

    const result: Visualize[] = rawVisualizes
      .map(parseVisualizes)
      .filter(defined)
      .filter(parsed => parsed.yAxes.length > 0)
      .map((parsed, i) => {
        return {
          chartType: parsed.chartType,
          yAxes: parsed.yAxes,
          label: String.fromCharCode(65 + i), // starts from 'A'
        };
      });

    return result.length
      ? result
      : [{chartType: ChartType.LINE, label: 'A', yAxes: [DEFAULT_VISUALIZATION]}];
  }, [location.query.visualize]);

  const setVisualizes = useCallback(
    (newVisualizes: BaseVisualize[]) => {
      const stringified: string[] = [];
      for (const visualize of newVisualizes) {
        // ignore the label from visualize because it'll determined later
        stringified.push(
          JSON.stringify({
            chartType: visualize.chartType,
            yAxes: visualize.yAxes,
          })
        );
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

function parseVisualizes(raw: string): BaseVisualize | null {
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
