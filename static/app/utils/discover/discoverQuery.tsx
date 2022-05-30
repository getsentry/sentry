import {EventsMetaType, MetaType} from 'sentry/utils/discover/eventView';
import withApi from 'sentry/utils/withApi';
import {TransactionThresholdMetric} from 'sentry/views/performance/transactionSummary/transactionThresholdModal';

import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from './genericDiscoverQuery';

/**
 * An individual row in a DiscoverQuery result
 */
export type TableDataRow = {
  [key: string]: React.ReactText;
  id: string;
};

/**
 * A DiscoverQuery result including rows and metadata.
 */
export type TableData = {
  data: Array<TableDataRow>;
  meta?: MetaType;
};

/**
 * A DiscoverQuery result including rows and metadata from the events endpoint.
 */
export type EventsTableData = {
  data: Array<TableDataRow>;
  meta?: EventsMetaType;
};

export type TableDataWithTitle = TableData & {title: string};

type DiscoverQueryPropsWithThresholds = DiscoverQueryProps & {
  transactionName?: string;
  transactionThreshold?: number;
  transactionThresholdMetric?: TransactionThresholdMetric;
};

type DiscoverQueryComponentProps = DiscoverQueryPropsWithThresholds & {
  children: (props: GenericChildrenProps<TableData>) => React.ReactNode;
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

function DiscoverQuery(props: DiscoverQueryComponentProps) {
  return (
    <GenericDiscoverQuery<TableData, DiscoverQueryPropsWithThresholds>
      route="eventsv2"
      shouldRefetchData={shouldRefetchData}
      {...props}
    />
  );
}

export default withApi(DiscoverQuery);
