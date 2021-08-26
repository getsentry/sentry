import * as React from 'react';

import {MetaType} from 'app/utils/discover/eventView';
import withApi from 'app/utils/withApi';
import {TransactionThresholdMetric} from 'app/views/performance/transactionSummary/transactionThresholdModal';

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

export type DiscoverQueryPropsWithThresholds = DiscoverQueryProps & {
  transactionName?: string;
  transactionThreshold?: number;
  transactionThresholdMetric?: TransactionThresholdMetric;
};

function shouldRefetchData(
  prevProps: DiscoverQueryPropsWithThresholds,
  nextProps: DiscoverQueryPropsWithThresholds
) {
  return (
    prevProps.transactionName !== nextProps.transactionName ||
    prevProps.transactionThreshold !== nextProps.transactionThreshold ||
    prevProps.transactionThresholdMetric !== nextProps.transactionThresholdMetric
  );
}

function DiscoverQuery(props: DiscoverQueryPropsWithThresholds) {
  return (
    <GenericDiscoverQuery<TableData, DiscoverQueryPropsWithThresholds>
      route="eventsv2"
      shouldRefetchData={shouldRefetchData}
      {...props}
    />
  );
}

export default withApi(DiscoverQuery);
