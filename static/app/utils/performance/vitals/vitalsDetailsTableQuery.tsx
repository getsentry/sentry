import * as React from 'react';

import {MetaType} from 'sentry/utils/discover/eventView';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import withApi from 'sentry/utils/withApi';

interface BaseDataRow {
  id: string;
  project: string;
  transaction: string;
  count: number;
  count_unique_user: number;
  team_key_transaction: number;
  [key: string]: React.ReactText;
}

interface LCPDataRow extends BaseDataRow {
  p50_measurements_lcp: number;
  p75_measurements_lcp: number;
  p95_measurements_lcp: number;
  compare_numeric_aggregate_p75_measurements_lcp_greater_2500: number;
  compare_numeric_aggregate_p75_measurements_lcp_greater_4000: number;
}

interface FCPDataRow extends BaseDataRow {
  p50_measurements_fcp: number;
  p75_measurements_fcp: number;
  p95_measurements_fcp: number;
  compare_numeric_aggregate_p75_measurements_fcp_greater_2500: number;
  compare_numeric_aggregate_p75_measurements_fcp_greater_4000: number;
}

interface CLSDataRow extends BaseDataRow {
  p50_measurements_cls: number;
  p75_measurements_cls: number;
  p95_measurements_cls: number;
  compare_numeric_aggregate_p75_measurements_cls_greater_2500: number;
  compare_numeric_aggregate_p75_measurements_cls_greater_4000: number;
}

interface FIDDataRow extends BaseDataRow {
  p50_measurements_fid: number;
  p75_measurements_fid: number;
  p95_measurements_fid: number;
  compare_numeric_aggregate_p75_measurements_fid_greater_2500: number;
  compare_numeric_aggregate_p75_measurements_fid_greater_4000: number;
}

// TODO(perf): Fix if/once we can send column aliases along with a request
export type TableDataRow = LCPDataRow | FCPDataRow | CLSDataRow | FIDDataRow;

export interface TableData {
  data: Array<TableDataRow>;
  meta?: MetaType;
}

type ChildrenProps = Omit<GenericChildrenProps<TableData>, 'tableData'> & {
  tableData: TableData | null;
};

interface QueryProps extends DiscoverQueryProps {
  children: (props: ChildrenProps) => React.ReactNode;
}

function VitalsCardsDiscoverQuery(props: QueryProps) {
  return <GenericDiscoverQuery<TableData, QueryProps> route="eventsv2" {...props} />;
}

export default withApi(VitalsCardsDiscoverQuery);
