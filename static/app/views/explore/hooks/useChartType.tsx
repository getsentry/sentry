import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {ChartType} from 'sentry/views/insights/common/components/chart';

interface Options {
  location: Location;
  navigate: ReturnType<typeof useNavigate>;
}

export function useChartType(): [ChartType, (chartType: ChartType) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const options = {location, navigate};

  return useChartTypeImpl(options);
}

function useChartTypeImpl({
  location,
  navigate,
}: Options): [ChartType, (chartType: ChartType) => void] {
  const chartType: ChartType = useMemo(() => {
    const parsedType = Number(decodeScalar(location.query.chartType));

    if (isNaN(parsedType) || !Object.values(ChartType).includes(parsedType)) {
      return ChartType.LINE;
    }

    return parsedType as ChartType;
  }, [location.query.chartType]);

  const setChartType = useCallback(
    (newChartType: ChartType) => {
      navigate({
        ...location,
        query: {
          ...location.query,
          chartType: newChartType,
        },
      });
    },
    [location, navigate]
  );

  return [chartType, setChartType];
}
