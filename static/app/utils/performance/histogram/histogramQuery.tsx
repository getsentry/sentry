import React from 'react';
import omit from 'lodash/omit';

import {Client} from 'app/api';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'app/utils/discover/genericDiscoverQuery';
import {DataFilter, HistogramData} from 'app/utils/performance/histogram/types';
import withApi from 'app/utils/withApi';

type Histograms = Record<string, HistogramData>;

type HistogramProps = {
  fields: string[];
  numBuckets: number;
  min?: number;
  max?: number;
  precision?: number;
  dataFilter?: DataFilter;
};

type RequestProps = DiscoverQueryProps & HistogramProps;

type ChildrenProps = Omit<GenericChildrenProps<HistogramProps>, 'tableData'> & {
  histograms: Histograms | null;
};

type Props = RequestProps & {
  children: (props: ChildrenProps) => React.ReactNode;
};

function getHistogramRequestPayload(props: RequestProps) {
  const {
    fields,
    numBuckets,
    min,
    max,
    precision,
    dataFilter,
    eventView,
    location,
  } = props;
  const baseApiPayload = {
    field: fields,
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

function HistogramQuery(props: Props) {
  const {children, fields} = props;
  if (fields.length === 0) {
    return (
      <React.Fragment>
        {children({
          isLoading: false,
          error: null,
          pageLinks: null,
          histograms: {},
        })}
      </React.Fragment>
    );
  }

  return (
    <GenericDiscoverQuery<Histograms, HistogramProps>
      route="events-histogram"
      getRequestPayload={getHistogramRequestPayload}
      beforeFetch={beforeFetch}
      {...omit(props, 'children')}
    >
      {({tableData, ...rest}) => {
        return props.children({histograms: tableData, ...rest});
      }}
    </GenericDiscoverQuery>
  );
}

export default withApi(HistogramQuery);
