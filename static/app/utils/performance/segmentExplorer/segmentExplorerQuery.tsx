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
  sumdelta: number;
  count: number;
  frequency: number;
  aggregate: number;
  comparison: number;
};

export type TableData = {
  data: TableDataRow[];
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
  allTagKeys?: boolean;
  tagKey?: string;
  sort?: string | string[];
  children: (props: ChildrenProps) => React.ReactNode;
};

type FacetQuery = LocationQuery &
  EventQuery & {
    sort?: string | string[];
    aggregateColumn?: string;
    allTagKeys?: boolean;
    tagKey?: string;
  };

export function getRequestFunction(_props: QueryProps) {
  const {aggregateColumn} = _props;
  function getTagExplorerRequestPayload(props: DiscoverQueryProps) {
    const {eventView} = props;
    const apiPayload: FacetQuery = eventView.getEventsAPIPayload(props.location);
    apiPayload.aggregateColumn = aggregateColumn;
    apiPayload.sort = _props.sort ? _props.sort : apiPayload.sort;
    if (_props.allTagKeys) {
      apiPayload.allTagKeys = _props.allTagKeys;
    }
    if (_props.tagKey) {
      apiPayload.tagKey = _props.tagKey;
    }
    return apiPayload;
  }
  return getTagExplorerRequestPayload;
}

function shouldRefetchData(prevProps: QueryProps, nextProps: QueryProps) {
  return (
    prevProps.aggregateColumn !== nextProps.aggregateColumn ||
    prevProps.sort !== nextProps.sort ||
    prevProps.allTagKeys !== nextProps.allTagKeys ||
    prevProps.tagKey !== nextProps.tagKey
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
