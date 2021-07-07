import * as React from 'react';

import {MetaType} from 'app/utils/discover/eventView';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
} from 'app/utils/discover/genericDiscoverQuery';
import withApi from 'app/utils/withApi';

export type TableDataRow = {
  id: string;
  [key: string]: React.ReactText;
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
