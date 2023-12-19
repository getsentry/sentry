import {Fragment, useMemo} from 'react';
import * as qs from 'query-string';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {
  TableData,
  TableDataRow,
  useDiscoverQuery,
} from 'sentry/utils/discover/discoverQuery';
import EventView, {isFieldSortable, MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import TopResultsIndicator from 'sentry/views/discover/table/topResultsIndicator';
import {TableColumn} from 'sentry/views/discover/table/types';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {formatVersionAndCenterTruncate} from 'sentry/views/starfish/utils/centerTruncate';
import {TOP_SCREENS} from 'sentry/views/starfish/views/screens';

const MAX_TABLE_RELEASE_CHARS = 15;

type Props = {
  data: TableData | undefined;
  eventView: EventView;
  isLoading: boolean;
  pageLinks: string | undefined;
  onCursor?: CursorHandler;
};

export function ScreensTable({data, eventView, isLoading, pageLinks, onCursor}: Props) {
  const location = useLocation();
  const {selection} = usePageFilters();
  const {projects} = useProjects();
  const organization = useOrganization();
  const {primaryRelease, secondaryRelease} = useReleaseSelection();
  const truncatedPrimary = formatVersionAndCenterTruncate(
    primaryRelease ?? '',
    MAX_TABLE_RELEASE_CHARS
  );
  const truncatedSecondary = formatVersionAndCenterTruncate(
    secondaryRelease ?? '',
    MAX_TABLE_RELEASE_CHARS
  );

  const project = useMemo(() => {
    if (selection.projects.length !== 1) {
      return null;
    }
    return projects.find(p => p.id === String(selection.projects));
  }, [projects, selection.projects]);

  const eventViewColumns = eventView.getColumns();

  const columnNameMap = {
    transaction: t('Screen'),
    [`avg_if(measurements.time_to_initial_display,release,${primaryRelease})`]: t(
      'TTID (%s)',
      truncatedPrimary
    ),
    [`avg_if(measurements.time_to_initial_display,release,${secondaryRelease})`]: t(
      'TTID (%s)',
      truncatedSecondary
    ),
    [`avg_if(measurements.time_to_full_display,release,${primaryRelease})`]: t(
      'TTFD (%s)',
      truncatedPrimary
    ),
    [`avg_if(measurements.time_to_full_display,release,${secondaryRelease})`]: t(
      'TTFD (%s)',
      truncatedSecondary
    ),
    'count()': t('Total Count'),
  };

  function renderBodyCell(column, row): React.ReactNode {
    if (!data?.meta || !data?.meta.fields) {
      return row[column.key];
    }

    const index = data.data.indexOf(row);

    const field = String(column.key);

    if (field === 'transaction') {
      return (
        <Fragment>
          <TopResultsIndicator count={TOP_SCREENS} index={index} />
          <Link
            to={normalizeUrl(
              `/organizations/${
                organization.slug
              }/performance/mobile/screens/spans/?${qs.stringify({
                ...location.query,
                project: row['project.id'],
                transaction: row.transaction,
                primaryRelease,
                secondaryRelease,
              })}`
            )}
            style={{display: `block`, width: `100%`}}
          >
            {row.transaction}
          </Link>
        </Fragment>
      );
    }

    const renderer = getFieldRenderer(column.key, data?.meta.fields, false);
    const rendered = renderer(row, {
      location,
      organization,
      unit: data?.meta.units?.[column.key],
    });
    if (
      column.key.includes('time_to_full_display') &&
      row[column.key] === 0 &&
      project?.platform &&
      ['android', 'apple-ios'].includes(project.platform)
    ) {
      const docsUrl =
        project?.platform === 'android'
          ? 'https://docs.sentry.io/platforms/android/performance/instrumentation/automatic-instrumentation/#time-to-full-display'
          : 'https://docs.sentry.io/platforms/apple/guides/ios/performance/instrumentation/automatic-instrumentation/#time-to-full-display';
      return (
        <div style={{textAlign: 'right'}}>
          <Tooltip
            title={tct(
              'Measuring TTFD requires manual instrumentation in your application. To learn how to collect TTFD, see the documentation [link].',
              {
                link: <ExternalLink href={docsUrl}>{t('here')}</ExternalLink>,
              }
            )}
            showUnderline
            isHoverable
          >
            {rendered}
          </Tooltip>
        </div>
      );
    }

    return rendered;
  }

  function renderHeadCell(
    column: GridColumnHeader,
    tableMeta?: MetaType
  ): React.ReactNode {
    const fieldType = tableMeta?.fields?.[column.key];
    const alignment = fieldAlignment(column.key as string, fieldType);
    const field = {
      field: column.key as string,
      width: column.width,
    };

    function generateSortLink() {
      if (!tableMeta) {
        return undefined;
      }

      const nextEventView = eventView.sortOnField(field, tableMeta);
      const queryStringObject = nextEventView.generateQueryStringObject();

      return {
        ...location,
        query: {...location.query, sort: queryStringObject.sort},
      };
    }

    const currentSort = eventView.sortForField(field, tableMeta);
    const currentSortKind = currentSort ? currentSort.kind : undefined;
    const canSort = isFieldSortable(field, tableMeta);

    const sortLink = (
      <SortLink
        align={alignment}
        title={column.name}
        direction={currentSortKind}
        canSort={canSort}
        generateSortLink={generateSortLink}
      />
    );
    return sortLink;
  }

  return (
    <Fragment>
      <GridEditable
        isLoading={isLoading}
        data={data?.data as TableDataRow[]}
        columnOrder={eventViewColumns
          .filter(
            (col: TableColumn<React.ReactText>) =>
              col.name !== SpanMetricsField.PROJECT_ID &&
              !col.name.startsWith('avg_compare')
          )
          .map((col: TableColumn<React.ReactText>) => {
            return {...col, name: columnNameMap[col.key] ?? col.name};
          })}
        columnSortBy={[
          {
            key: 'count()',
            order: 'desc',
          },
        ]}
        location={location}
        grid={{
          renderHeadCell: column => renderHeadCell(column, data?.meta),
          renderBodyCell,
        }}
      />
      <Pagination pageLinks={pageLinks} onCursor={onCursor} />
    </Fragment>
  );
}

export function useTableQuery({
  eventView,
  enabled,
  referrer,
  initialData,
  limit,
  staleTime,
  cursor,
}: {
  eventView: EventView;
  cursor?: string;
  enabled?: boolean;
  excludeOther?: boolean;
  initialData?: TableData;
  limit?: number;
  referrer?: string;
  staleTime?: number;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const {isReady: pageFiltersReady} = usePageFilters();

  const result = useDiscoverQuery({
    eventView,
    location,
    orgSlug: organization.slug,
    limit: limit ?? 25,
    referrer,
    cursor,
    options: {
      refetchOnWindowFocus: false,
      enabled: enabled && pageFiltersReady,
      staleTime,
    },
  });

  return {
    ...result,
    data: result.isLoading ? initialData : result.data,
    pageLinks: result.pageLinks,
  };
}
