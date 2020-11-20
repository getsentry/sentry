import React from 'react';

import {MetaType} from 'app/utils/discover/eventView';
import withApi from 'app/utils/withApi';

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

function DiscoverQuery(props: DiscoverQueryProps) {
  return <GenericDiscoverQuery<TableData, {}> route="eventsv2" {...props} />;
}

export default withApi(DiscoverQuery);
