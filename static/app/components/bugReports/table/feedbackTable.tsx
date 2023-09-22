import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import renderSortableHeaderCell from 'sentry/components/bugReports/table/renderSortableHeaderCell';
import useQueryBasedColumnResize from 'sentry/components/bugReports/table/useQueryBasedColumnResize';
import useQueryBasedSorting from 'sentry/components/bugReports/table/useQueryBasedSorting';
import GridEditable, {GridColumnOrder} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import Tag from 'sentry/components/tag';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getShortEventId} from 'sentry/utils/events';
import type {
  FeedbackListQueryParams,
  HydratedFeedbackItem,
  HydratedFeedbackList,
} from 'sentry/utils/feedback/types';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
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
  {key: 'feedback_id', name: 'ID'},
  {key: 'status', name: 'status'},
  {key: 'contact_email', name: 'contact_email'},
  {key: 'message', name: 'message'},
  {key: 'replay_id', name: 'Replay'},
  {key: 'timestamp', name: 'timestamp'},
];

export default function FeedbackTable({isError, isLoading, data, location}: Props) {
  const routes = useRoutes();
  const organization = useOrganization();
  const {projects} = useProjects();

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
    (column, dataRow: HydratedFeedbackItem) => {
      const value = dataRow[column.key];
      switch (column.key) {
        case 'feedback_id':
          const project = projects.find(p => p.id === String(dataRow.project_id));
          if (!project) {
            // TODO[feedback]: Guard against invalid test data that has no valid project.
            return null;
          }
          return (
            <FeedbackDetailsLink
              organization={organization}
              project={project!}
              value={value}
            />
          );
        case 'status':
          return <Tag type={value === 'resolved' ? 'default' : 'warning'}>{value}</Tag>;
        case 'message':
          return <TextOverflow>{value}</TextOverflow>;
        case 'replay_id': {
          const referrer = getRouteStringFromRoutes(routes);
          if (!value) {
            return null;
          }
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
    [routes, organization, projects]
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
  project,
  value,
}: {
  organization: Organization;
  project: Project;
  value: string;
}) {
  return (
    <Link
      to={{
        pathname: normalizeUrl(
          `/organizations/${organization.slug}/feedback/${project.slug}:${value}/`
        ),
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
