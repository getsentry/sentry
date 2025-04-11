import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

/**
 * Row represents a point in a timeseries - plotting (timestamp, value) with a line between them would represent a line chart.
 */
export interface Row {
  /** timestamp: The time (in seconds) of this point in the time series */
  timestamp: number;

  /** value: The float value of this point in the time series (i.e., how high it is in the graph) */
  value: number;

  // comparisonValue: For alerts - we run two timeseries, where one is some delta
  // in the past (say, 5 minutes before the 'real timeseries') - this value is the analogue of 'value'
  // for the second timeseries in the past.
  // Alerts use this to calculate a relative change in timeseries with ((value - comparisonValue) / comparisonValue) * 100
  comparisonValue?: number;

  /** confidence: For sampled datasets - whether there is enough data for the timeseries to be accurate. */
  confidence?: 'low' | 'high';

  /** sampleCount: For sampled datasets - how many samples were used to calculate this datapoint. */
  sampleCount?: number;

  /** sampleRate: For sampled datasets - 0.1 represents 9/10 events being deleted due to sampling */
  sampleRate?: number;
}

/**
 * SeriesMeta represents metadata about a single timeseries.
 *
 * For example, it might say what type of data is in this timeseries.
 */
export interface SeriesMeta {
  /** valueType: The type of the unit, e.g., 'duration' or 'size' */
  valueType: string;

  /** interval: The rollup for this time series (TODO: better description) */
  interval?: number;

  /** isOther: for "top events" timeseries - whether this timeseries it the 'other / rest' category */
  isOther?: string;

  /** order: for "top events" timeseries - the index of this timeseries (0 is most common) */
  order?: number;

  /** valueUnit: The unit of this chart, e.g., 'microsecond' */
  valueUnit?: string;
}

/**
 * TimeSeries represents a single timeseries being returned.
 */
export interface TimeSeries {
  /** meta: Metadata about this specific timeseries, like its unit */
  meta: SeriesMeta;

  /** Values: The actual data points for this timeseries */
  values: Row[];

  /** yaxis: The displayable y-axis, e.g.: sum(span.duration) */
  yaxis: string;

  /** groupBy: The requested 'GROUP BY' fields for this timeseries */
  groupBy?: string[];
}

export interface StatsMeta {
  /** dataset: Which dataset was queried for this data */
  dataset: `${DiscoverDatasets}`;

  /** end: The end epoch time (in milliseconds) for the data */
  end: number;

  /** start: The start epoch time (in milliseconds) for the data */
  start: number;
}

/**
 * StatsResponse returns zero or more timeseries, and associated global metadata.
 */
export interface StatsResponse {
  /** meta: Metadata about the entire response (like which dataset was used) */
  meta: StatsMeta;

  /** timeseries: The actual timeseries data */
  timeseries: TimeSeries[];
}

export interface UseTimeseriesProps {
  /** The name of the dataset to target for this request */
  dataset: `${DiscoverDatasets}`;

  /** The end timestamp for this request */
  end?: any;

  /** The fields to plot, e.g., count() or message */
  field?: string[];

  /** The keys to order by, e.g., -count() */
  orderby?: string[];

  /** The project IDs to target */
  project?: string[];

  /** The start timestamp for this request */
  start?: any;

  // The maximum number of events to return - if you groupBy user.id, with topEvents=5,
  // this would plot count() for the top 5 users, and add a sixth row for 'other' with isOther=true
  //
  topEvents?: number;

  /** The y axes to plot, e.g., count() or sum(my.value) */
  yAxis?: string[];
}

export function useTimeseries(props: UseTimeseriesProps) {
  const {selection} = usePageFilters();
  const {start: pageFilterStart, end: pageFilterEnd} = selection.datetime;
  const organization = useOrganization();
  return useApiQuery<StatsResponse>([
    `/${organization.slug}/events-timeseries/`,
    {
      query: {
        ...props,
        start: props.start ?? pageFilterStart,
        end: props.end ?? pageFilterEnd,
        dataset: props.dataset,
        yAxis: props.yAxis ?? ['count()'],
        field: props.field ?? ['count()'],
      },
    },
  ]);
}
