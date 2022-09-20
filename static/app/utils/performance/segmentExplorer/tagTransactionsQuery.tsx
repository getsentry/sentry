import {MetaType} from 'sentry/utils/discover/eventView';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';

export type TableDataRow = {
  [key: string]: React.ReactText;
  id: string;
};

export type TableData = {
  data: Array<TableDataRow>;
  meta?: MetaType;
};

type QueryProps = DiscoverQueryProps & {
  children: (props: GenericChildrenProps<TableData>) => React.ReactNode;
  query: string;
};

function shouldRefetchData(prevProps: QueryProps, nextProps: QueryProps) {
  return prevProps.query !== nextProps.query;
}

function TagTransactionsQuery(props: QueryProps) {
  return (
    <GenericDiscoverQuery<TableData, QueryProps>
      route="events"
      shouldRefetchData={shouldRefetchData}
      {...props}
    />
  );
}

export default TagTransactionsQuery;
