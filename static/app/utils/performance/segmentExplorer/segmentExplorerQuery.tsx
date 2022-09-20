import {EventQuery} from 'sentry/actionCreators/events';
import {LocationQuery} from 'sentry/utils/discover/eventView';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';

/**
 * An individual row in a Segment explorer result
 */
export type TableDataRow = {
  aggregate: number;
  comparison: number;
  count: number;
  frequency: number;
  sumdelta: number;
  tags_key: string;
  tags_value: string;
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
  children: (props: ChildrenProps) => React.ReactNode;
  allTagKeys?: boolean;
  sort?: string | string[];
  tagKey?: string;
};

type FacetQuery = LocationQuery &
  EventQuery & {
    aggregateColumn?: string;
    allTagKeys?: boolean;
    sort?: string | string[];
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

export default SegmentExplorerQuery;
