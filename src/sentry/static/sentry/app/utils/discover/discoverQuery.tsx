import React from 'react';

import withApi from 'app/utils/withApi';
import {MetaType} from 'app/utils/discover/eventView';

import GenericDiscoverQuery, {DiscoverQueryProps} from './genericDiscoverQuery';

/**
 * An individual row in a DiscoverQuery result
 */
export type TableDataRow = {
  id: string;
  [key: string]: React.ReactText;
};

/**
 * A DiscoverQuery result including rows and metadata.
 */
export type TableData = {
  data: Array<TableDataRow>;
  meta?: MetaType;
};

type Props = DiscoverQueryProps & {
  keyTransactions?: boolean;
};

function getRoute(keyTransactions?: boolean) {
  if (keyTransactions) {
    return 'key-transactions';
  }
  return 'eventsv2';
}

function DiscoverQuery(props: Props) {
  const {keyTransactions} = props;
  const route = getRoute(keyTransactions);
  return <GenericDiscoverQuery<TableData, {}> route={route} {...props} />;
}

export default withApi(DiscoverQuery);
