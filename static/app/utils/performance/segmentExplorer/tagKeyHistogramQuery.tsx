import * as React from 'react';

import {EventQuery} from 'app/actionCreators/events';
import {LocationQuery} from 'app/utils/discover/eventView';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'app/utils/discover/genericDiscoverQuery';
import withApi from 'app/utils/withApi';

/**
 * An individual row in a Segment explorer result
 */
export type TableDataRow = {
  tags_key: string;
  tags_value: string;
  count: number;
  [key: string]: React.ReactText;
};

export type HistogramTag = {
  tags_value: string;
};

export type TableData = {
  histogram: {data: TableDataRow[]};
  tags: {data: HistogramTag[]};
  meta: {};
};

/**
 * A Segment Explorer result including rows and metadata.
 */

type ChildrenProps = Omit<GenericChildrenProps<TableData>, 'tableData'> & {
  tableData: TableData | null;
};

type QueryProps = DiscoverQueryProps & {
  aggregateColumn: string;
  tagKey: string;
  tagKeyLimit: number;
  numBucketsPerKey: number;
  sort?: string | string[];
  children: (props: ChildrenProps) => React.ReactNode;
};

type FacetQuery = LocationQuery &
  EventQuery & {
    tagKey?: string;
    tagKeyLimit?: number;
    numBucketsPerKey?: number;
    sort?: string | string[];
    aggregateColumn?: string;
  };

export function getRequestFunction(_props: QueryProps) {
  const {aggregateColumn} = _props;
  function getTagExplorerRequestPayload(props: DiscoverQueryProps) {
    const {eventView} = props;
    const apiPayload: FacetQuery = eventView.getEventsAPIPayload(props.location);
    apiPayload.aggregateColumn = aggregateColumn;
    apiPayload.sort = _props.sort ? _props.sort : '-sumdelta';
    apiPayload.tagKey = _props.tagKey;
    apiPayload.tagKeyLimit = _props.tagKeyLimit;
    apiPayload.numBucketsPerKey = _props.numBucketsPerKey;
    return apiPayload;
  }
  return getTagExplorerRequestPayload;
}

function shouldRefetchData(prevProps: QueryProps, nextProps: QueryProps) {
  return (
    prevProps.aggregateColumn !== nextProps.aggregateColumn ||
    prevProps.sort !== nextProps.sort ||
    prevProps.tagKey !== nextProps.tagKey
  );
}

function TagKeyHistogramQuery(props: QueryProps) {
  return (
    <GenericDiscoverQuery<TableData, QueryProps>
      route="events-facets-performance-histogram"
      getRequestPayload={getRequestFunction(props)}
      shouldRefetchData={shouldRefetchData}
      {...props}
    />
  );
}

export default withApi(TagKeyHistogramQuery);
