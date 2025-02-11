import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import type {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import GenericDiscoverQuery from 'sentry/utils/discover/genericDiscoverQuery';

type BaseDataRow = {
  [key: string]: React.ReactText;
  count: number;
  count_unique_user: number;
  id: string;
  project: string;
  team_key_transaction: number;
  transaction: string;
};

type LCPDataRow = BaseDataRow & {
  compare_numeric_aggregate_p75_measurements_lcp_greater_2500: number;
  compare_numeric_aggregate_p75_measurements_lcp_greater_4000: number;
  p50_measurements_lcp: number;
  p75_measurements_lcp: number;
  p95_measurements_lcp: number;
};
type FCPDataRow = BaseDataRow & {
  compare_numeric_aggregate_p75_measurements_fcp_greater_2500: number;
  compare_numeric_aggregate_p75_measurements_fcp_greater_4000: number;
  p50_measurements_fcp: number;
  p75_measurements_fcp: number;
  p95_measurements_fcp: number;
};
type CLSDataRow = BaseDataRow & {
  compare_numeric_aggregate_p75_measurements_cls_greater_2500: number;
  compare_numeric_aggregate_p75_measurements_cls_greater_4000: number;
  p50_measurements_cls: number;
  p75_measurements_cls: number;
  p95_measurements_cls: number;
};
type FIDDataRow = BaseDataRow & {
  compare_numeric_aggregate_p75_measurements_fid_greater_2500: number;
  compare_numeric_aggregate_p75_measurements_fid_greater_4000: number;
  p50_measurements_fid: number;
  p75_measurements_fid: number;
  p95_measurements_fid: number;
};

// TODO(perf): Fix if/once we can send column aliases along with a request
export type TableDataRow = LCPDataRow | FCPDataRow | CLSDataRow | FIDDataRow;

export type TableData = {
  data: TableDataRow[];
  meta?: EventsMetaType;
};

type ChildrenProps = Omit<GenericChildrenProps<TableData>, 'tableData'> & {
  tableData: TableData | null;
};

type QueryProps = DiscoverQueryProps & {
  children: (props: ChildrenProps) => React.ReactNode;
};

function VitalsCardsDiscoverQuery(props: QueryProps) {
  return <GenericDiscoverQuery<TableData, QueryProps> route="events" {...props} />;
}

export default VitalsCardsDiscoverQuery;
