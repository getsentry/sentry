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
  useEvents?: boolean;
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
  const endpoint = props.useEvents ? 'events' : 'eventsv2';
  const afterFetch = props.useEvents
    ? (data, _) => {
        const {fields, ...otherMeta} = data.meta ?? {};
        return {
          ...data,
          meta: {...fields, ...otherMeta},
        };
      }
    : undefined;
  return (
    <GenericDiscoverQuery<TableData, DiscoverQueryPropsWithThresholds>
      route={endpoint}
      shouldRefetchData={shouldRefetchData}
      afterFetch={afterFetch}
      {...props}
    />
  );
}

export default withApi(DiscoverQuery);
