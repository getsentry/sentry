import React from 'react';
import omit from 'lodash/omit';

import {Client} from 'app/api';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'app/utils/discover/genericDiscoverQuery';
import withApi from 'app/utils/withApi';

import {HistogramData} from './types';

type RawHistogramResponse = {
  data: RawHistogramData[];
};

type RawHistogramData = {
  key: string;
  bin: number;
  count: number;
};

type Histograms = Record<string, HistogramData[]>;

type MeasurementsData = {
  measurements: string[];
  numBuckets: number;
  min?: number;
  max?: number;
  precision?: number;
  dataFilter?: string;
};

type RequestProps = DiscoverQueryProps & MeasurementsData;

type ChildrenProps = Omit<GenericChildrenProps<MeasurementsData>, 'tableData'> & {
  histograms: Histograms | null;
};

type Props = RequestProps & {
  children: (props: ChildrenProps) => React.ReactNode;
};

function getMeasurementsHistogramRequestPayload(props: any) {
  const {
    measurements,
    numBuckets,
    min,
    max,
    precision,
    dataFilter,
    eventView,
    location,
  } = props;
  const baseApiPayload = {
    measurement: measurements,
    numBuckets,
    min,
    max,
    precision,
    dataFilter,
  };
  const additionalApiPayload = omit(eventView.getEventsAPIPayload(location), [
    'field',
    'sort',
    'per_page',
  ]);
  const apiPayload = Object.assign(baseApiPayload, additionalApiPayload);
  return apiPayload;
}

function beforeFetch(api: Client) {
  api.clear();
}

function afterFetch(
  response: RawHistogramResponse,
  props: RequestProps
): Record<string, HistogramData[]> {
  const data = response.data;
  const {measurements} = props;

  const histogramData = measurements.reduce((record, measurement) => {
    record[`measurements.${measurement}`] = [];
    return record;
  }, {});

  data?.forEach(row => {
    histogramData[`measurements.${row.key}`].push({
      histogram: row.bin,
      count: row.count,
    });
  });

  return histogramData;
}

function MeasurementsHistogramQuery(props: Props) {
  return (
    <GenericDiscoverQuery<Histograms, MeasurementsData>
      route="events-measurements-histogram"
      getRequestPayload={getMeasurementsHistogramRequestPayload}
      beforeFetch={beforeFetch}
      afterFetch={afterFetch}
      {...omit(props, 'children')}
    >
      {({tableData, ...rest}) => {
        return props.children({histograms: tableData, ...rest});
      }}
    </GenericDiscoverQuery>
  );
}

export default withApi(MeasurementsHistogramQuery);
