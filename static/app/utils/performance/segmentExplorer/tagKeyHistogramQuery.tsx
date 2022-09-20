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
  [key: string]: React.ReactText;
  count: number;
  tags_key: string;
  tags_value: string;
};

export type HistogramTag = {
  tags_value: string;
};

export type TableData = {
  histogram: {data: TableDataRow[]};
  meta: {};
  tags: {data: HistogramTag[]};
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
  numBucketsPerKey: number;
  sort: string | string[];
  tagKey: string;
};

type FacetQuery = LocationQuery &
  EventQuery & {
    aggregateColumn?: string;
    numBucketsPerKey?: number;
    sort?: string | string[];
    tagKey?: string;
  };

export function getRequestFunction(_props: QueryProps) {
  const {aggregateColumn} = _props;
  function getTagExplorerRequestPayload(props: DiscoverQueryProps) {
    const {eventView} = props;
    const apiPayload: FacetQuery = eventView.getEventsAPIPayload(props.location);
    apiPayload.aggregateColumn = aggregateColumn;
    apiPayload.sort = _props.sort;
    apiPayload.tagKey = _props.tagKey;
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

export default TagKeyHistogramQuery;
