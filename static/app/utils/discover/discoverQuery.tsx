import {useQuery, type UseQueryOptions} from '@tanstack/react-query';

import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import type {TransactionThresholdMetric} from 'sentry/views/performance/transactionSummary/transactionThresholdModal';

import type {EventsMetaType, MetaType} from './eventView';
import type {DiscoverQueryProps, GenericChildrenProps} from './genericDiscoverQuery';
import {
  GenericDiscoverQuery,
  getDiscoverQueryPayload,
  parseError,
} from './genericDiscoverQuery';

/**
 * An individual row in a DiscoverQuery result
 */
export type TableDataRow = {[key: string]: string | number; id: string};

/**
 * A DiscoverQuery result including rows and metadata.
 */
export type TableData = {data: TableDataRow[]; meta?: MetaType};

/**
 * A DiscoverQuery result including rows and metadata from the events endpoint.
 */
export type EventsTableData = {data: TableDataRow[]; meta?: EventsMetaType};

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

export function DiscoverQuery(props: DiscoverQueryComponentProps) {
  const afterFetch = (data: any, _: any) => {
    const {fields, ...otherMeta} = data.meta ?? {};
    return {...data, meta: {...fields, ...otherMeta, fields}};
  };
  return (
    <GenericDiscoverQuery<TableData, DiscoverQueryPropsWithThresholds>
      route="events"
      shouldRefetchData={shouldRefetchData}
      afterFetch={afterFetch}
      {...props}
    />
  );
}

type DiscoverQueryOptions = Omit<
  UseQueryOptions<ApiResponse<TableData>, Error, ApiResponse<TableData>, ApiQueryKey>,
  'queryKey' | 'queryFn' | 'select'
>;

export function useDiscoverQuery({
  options,
  ...props
}: DiscoverQueryPropsWithThresholds & {options?: DiscoverQueryOptions}) {
  const res = useQuery({
    ...apiOptions.as<TableData>()('/organizations/$organizationIdOrSlug/events/', {
      path: {organizationIdOrSlug: props.orgSlug},
      query: getDiscoverQueryPayload(props),
      staleTime: 0,
    }),
    select: selectJsonWithHeaders,
    ...options,
  });

  return {
    // eslint-disable-next-line @tanstack/query/no-rest-destructuring
    ...res,
    data: res.data?.json,
    error: parseError(res.error),
    pageLinks: res.data?.headers.Link,
  };
}
