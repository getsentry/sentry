import {MetaType} from 'sentry/utils/discover/eventView';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import withApi from 'sentry/utils/withApi';

export type TableDataRow = {
  [key: string]: React.ReactText;
  id: string;
};

export type TableData = {
  data: Array<TableDataRow>;
  meta?: MetaType;
};

type QueryProps = DiscoverQueryProps & {
  query: string;
};

function shouldRefetchData(prevProps: QueryProps, nextProps: QueryProps) {
  return prevProps.query !== nextProps.query;
}

function TagTransactionsQuery(props: QueryProps) {
  return (
    <GenericDiscoverQuery<TableData, QueryProps>
      route="eventsv2"
      shouldRefetchData={shouldRefetchData}
      {...props}
    />
  );
}

export default withApi(TagTransactionsQuery);
