import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import renderSortableHeaderCell from 'sentry/components/feedback/table/renderSortableHeaderCell';
import useQueryBasedColumnResize from 'sentry/components/feedback/table/useQueryBasedColumnResize';
import useQueryBasedSorting from 'sentry/components/feedback/table/useQueryBasedSorting';
import GridEditable, {GridColumnOrder} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import Tag from 'sentry/components/tag';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getShortEventId} from 'sentry/utils/events';
import type {
  FeedbackListQueryParams,
  HydratedFeedbackItem,
  HydratedFeedbackList,
} from 'sentry/utils/feedback/types';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

interface UrlState {
  widths: string[];
}

interface Props {
  data: HydratedFeedbackList;
  isError: boolean;
  isLoading: boolean;
  location: Location<FeedbackListQueryParams & UrlState>;
}

const BASE_COLUMNS: GridColumnOrder<string>[] = [
  {key: 'id', name: 'id'},
  {key: 'status', name: 'status'},
  {key: 'contact_email', name: 'contact_email'},
  {key: 'message', name: 'message'},
  {key: 'replay_id', name: 'Replay'},
  {key: 'timestamp', name: 'timestamp'},
];

export default function FeedbackTable({isError, isLoading, data, location}: Props) {
  const routes = useRoutes();
  const organization = useOrganization();

  const {currentSort, makeSortLinkGenerator} = useQueryBasedSorting({
    defaultSort: {field: 'status', kind: 'desc'},
    location,
  });

  const {columns, handleResizeColumn} = useQueryBasedColumnResize({
    columns: BASE_COLUMNS,
    location,
  });

  const renderHeadCell = useMemo(
    () =>
      renderSortableHeaderCell({
        currentSort,
        makeSortLinkGenerator,
        onClick: () => {},
        rightAlignedColumns: [],
        sortableColumns: columns,
      }),
    [columns, currentSort, makeSortLinkGenerator]
  );

  const renderBodyCell = useCallback(
    (column, dataRow) => {
      const value = dataRow[column.key];
      switch (column.key) {
        case 'id':
          return <FeedbackDetailsLink organization={organization} value={value} />;
        case 'status':
          return <Tag type={value === 'resolved' ? 'default' : 'warning'}>{value}</Tag>;
        case 'message':
          return <TextOverflow>{value}</TextOverflow>;
        case 'replay_id': {
          const referrer = getRouteStringFromRoutes(routes);
          return (
            <Tooltip title={t('View Replay')}>
              <Link
                to={{
                  pathname: normalizeUrl(
                    `/organizations/${organization.slug}/replays/${value}/`
                  ),
                  query: {referrer},
                }}
              >
                {getShortEventId(value)}
              </Link>
            </Tooltip>
          );
        }
        default:
          return renderSimpleBodyCell<HydratedFeedbackItem>(column, dataRow);
      }
    },
    [organization, routes]
  );

  return (
    <GridEditable
      error={isError}
      isLoading={isLoading}
      data={data ?? []}
      columnOrder={columns}
      columnSortBy={[]}
      stickyHeader
      grid={{
        onResizeColumn: handleResizeColumn,
        renderHeadCell,
        renderBodyCell,
      }}
      location={location as Location<any>}
    />
  );
}

function FeedbackDetailsLink({
  organization,
  value,
}: {
  organization: Organization;
  value: string;
}) {
  return (
    <Link
      to={{
        pathname: normalizeUrl(`/organizations/${organization.slug}/feedback/${value}/`),
        query: {referrer: 'feedback_list_page'},
      }}
      onClick={() => {
        trackAnalytics('feedback_list.details_link.click', {organization});
      }}
    >
      {getShortEventId(value)}
    </Link>
  );
}

function renderSimpleBodyCell<T>(column: GridColumnOrder<string>, dataRow: T) {
  const value = dataRow[column.key];
  if (value instanceof Date) {
    return <TimeSince date={value} />;
  }
  return dataRow[column.key];
}
