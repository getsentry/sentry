import mean from 'lodash/mean';

import {RenderProps} from 'app/components/charts/eventsRequest';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {defined} from 'app/utils';
import {axisLabelFormatter} from 'app/utils/discover/charts';
import {aggregateOutputType} from 'app/utils/discover/fields';

import {QueryDefinitionWithKey, WidgetDataConstraint, WidgetPropUnion} from '../types';

export function transformEventsRequestToArea<T extends WidgetDataConstraint>(
  widgetProps: WidgetPropUnion<T>,
  results: RenderProps,
  _: QueryDefinitionWithKey<T>
) {
  const {start, end, utc, interval, statsPeriod} = getParams(widgetProps.location.query);

  const data = results.timeseriesData ?? [];

  const dataMean = data.map(series => {
    const meanData = mean(series.data.map(({value}) => value));

    return {
      mean: meanData,
      outputType: aggregateOutputType(series.seriesName),
      label: axisLabelFormatter(meanData, series.seriesName),
    };
  });

  const childData = {
    ...results,
    isLoading: results.loading,
    isErrored: results.errored,
    hasData: defined(data) && data.length && !!data[0].data.length,
    data,
    dataMean,
    previousData: results.previousTimeseriesData ?? undefined,

    utc: utc === 'true',
    interval,
    statsPeriod: statsPeriod ?? undefined,
    start: start ?? '',
    end: end ?? '',
  };

  return childData;
}
