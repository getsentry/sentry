import React from 'react';

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
  id: string;
  key: string;
  [key: string]: string | number | TopValue[];
};

export type TopValue = {
  name: string;
  value: string;
  aggregate: number;
  count: number;
};

/**
 * A Segment Explorer result including rows and metadata.
 */
export type TableData = TableDataRow[];

type ChildrenProps = Omit<GenericChildrenProps<TableData>, 'tableData'> & {
  tableData: TableData | null;
};

type QueryProps = DiscoverQueryProps & {
  tagOrder: string;
  aggregateColumn: string;
  children: (props: ChildrenProps) => React.ReactNode;
};

type FacetQuery = LocationQuery &
  EventQuery & {
    order?: string;
    aggregateColumn?: string;
  };

export function getRequestFunction(_props: QueryProps) {
  const {tagOrder, aggregateColumn} = _props;
  function getTagExplorerRequestPayload(props: DiscoverQueryProps) {
    const {eventView} = props;
    const apiPayload: FacetQuery = eventView?.getEventsAPIPayload(props.location);
    apiPayload.order = tagOrder;
    apiPayload.aggregateColumn = aggregateColumn;
    return apiPayload;
  }
  return getTagExplorerRequestPayload;
}

function shouldRefetchData(prevProps: QueryProps, nextProps: QueryProps) {
  return (
    prevProps.tagOrder !== nextProps.tagOrder ||
    prevProps.aggregateColumn !== nextProps.aggregateColumn
  );
}

function SegmentExplorerQuery(props: QueryProps) {
  return (
    <GenericDiscoverQuery<TableData, QueryProps>
      route="events-facets-performance"
      getRequestPayload={getRequestFunction(props)}
      shouldRefetchData={shouldRefetchData}
      {...props}
    />
  );
}

export default withApi(SegmentExplorerQuery);
