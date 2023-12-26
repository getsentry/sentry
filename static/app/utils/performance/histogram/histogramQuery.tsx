import {Fragment} from 'react';

import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {DataFilter, HistogramData} from 'sentry/utils/performance/histogram/types';

type Histograms = Record<string, HistogramData>;

type HistogramProps = {
  fields: string[];
  numBuckets: number;
  dataFilter?: DataFilter;
  didReceiveMultiAxis?: (axisCounts: Record<string, number>) => void;
  max?: number;
  min?: number;
  precision?: number;
};

type RequestProps = DiscoverQueryProps & HistogramProps;

export type HistogramQueryChildrenProps = Omit<
  GenericChildrenProps<HistogramProps>,
  'tableData'
> & {
  histograms: Histograms | null;
};

type Props = RequestProps & {
  children: (props: HistogramQueryChildrenProps) => React.ReactNode;
};

function getHistogramRequestPayload(props: RequestProps) {
  const {fields, numBuckets, min, max, precision, dataFilter, eventView, location} =
    props;
  const baseApiPayload = {
    field: fields,
    numBuckets,
    min,
    max,
    precision,
    dataFilter,
  };
  const {
    field: _f,
    sort: _s,
    per_page: _so,
    ...additionalApiPayload
  } = eventView.getEventsAPIPayload(location);

  const apiPayload = Object.assign(baseApiPayload, additionalApiPayload);
  return apiPayload;
}

function HistogramQuery(props: Props) {
  const {children, fields, didReceiveMultiAxis} = props;

  function didFetch(data: Histograms) {
    if (didReceiveMultiAxis) {
      const counts: Record<string, number> = {};
      Object.entries(data).forEach(
        ([key, values]) =>
          (counts[key] = values.length
            ? values.reduce((prev, curr) => prev + curr.count, 0)
            : 0)
      );
      didReceiveMultiAxis(counts);
    }
  }

  if (fields.length === 0) {
    return (
      <Fragment>
        {children({
          isLoading: false,
          error: null,
          pageLinks: null,
          histograms: {},
        })}
      </Fragment>
    );
  }

  const {children: _, ...propsWithoutChildren} = props;
  return (
    <GenericDiscoverQuery<Histograms, HistogramProps>
      route="events-histogram"
      getRequestPayload={getHistogramRequestPayload}
      didFetch={didFetch}
      {...propsWithoutChildren}
    >
      {({tableData, ...rest}) => {
        return props.children({histograms: tableData, ...rest});
      }}
    </GenericDiscoverQuery>
  );
}

export default HistogramQuery;
