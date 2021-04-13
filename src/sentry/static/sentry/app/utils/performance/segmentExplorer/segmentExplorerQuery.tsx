import React from 'react';

import {EventQuery} from 'app/actionCreators/events';
import {LocationQuery} from 'app/utils/discover/eventView';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'app/utils/discover/genericDiscoverQuery';
import withApi from 'app/utils/withApi';

type IncomingDataRow = {
  id: string;
  key: string;
  topValues: TopValue[];
  [key: string]: string | number | IncomingTopValue[];
};

type IncomingTopValue = {
  name: string;
  value: string;
  aggregate: number;
  count: number;
  comparison: number;
  isOther?: boolean;
};

type IncomingTableData = IncomingDataRow[];

/**
 * An individual row in a Segment explorer result
 */
export type TableDataRow = IncomingDataRow & {
  aggregate: number;
  tagValue: TagHint;
  frequency: number;
  comparison: number;
  otherValues: TopValue[];
};

export type TagHint = {
  name: string;
  value: string;
};

export type TopValue = IncomingTopValue & {};

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
    const apiPayload: FacetQuery = eventView.getEventsAPIPayload(props.location);
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

function afterFetch(data: IncomingTableData) {
  const newData = data as TableData;
  return newData.map(row => {
    const firstItem = row.topValues[0];
    row.tagValue = firstItem;
    row.aggregate = firstItem.aggregate;
    row.frequency = firstItem.count;
    row.comparison = firstItem.comparison;
    row.otherValues = row.topValues.slice(0);
    const otherEventValue = row.topValues.reduce((acc, curr) => acc - curr.count, 1);
    if (otherEventValue > 0.01) {
      row.otherValues.push({
        name: 'other',
        value: 'other',
        isOther: true,
        aggregate: 0,
        count: otherEventValue,
        comparison: 0,
      });
    }
    return row;
  });
}

function SegmentExplorerQuery(props: QueryProps) {
  return (
    <GenericDiscoverQuery<TableData, QueryProps>
      route="events-facets-performance"
      getRequestPayload={getRequestFunction(props)}
      shouldRefetchData={shouldRefetchData}
      afterFetch={afterFetch}
      {...props}
    />
  );
}

export default withApi(SegmentExplorerQuery);
