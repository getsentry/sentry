import {Fragment} from 'react';
import * as qs from 'query-string';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
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
import TopResultsIndicator from 'sentry/views/discover/table/topResultsIndicator';
import {TableColumn} from 'sentry/views/discover/table/types';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {centerTruncate} from 'sentry/views/starfish/utils/centerTruncate';
import {useRoutingContext} from 'sentry/views/starfish/utils/routingContext';
import {TOP_SCREENS} from 'sentry/views/starfish/views/screens';

type Props = {
  data: TableData | undefined;
  eventView: EventView;
  isLoading: boolean;
  pageLinks: string | undefined;
};

export function ScreensTable({data, eventView, isLoading, pageLinks}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const routingContext = useRoutingContext();
  const {primaryRelease, secondaryRelease} = useReleaseSelection();
  const truncatedPrimary = centerTruncate(primaryRelease ?? '', 15);
  const truncatedSecondary = centerTruncate(secondaryRelease ?? '', 15);

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
            to={`${routingContext.baseURL}/pageload/spans/?${qs.stringify({
              ...location.query,
              project: row['project.id'],
              transaction: row.transaction,
              primaryRelease,
              secondaryRelease,
            })}`}
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
            return {...col, name: columnNameMap[col.key]};
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
      <Pagination pageLinks={pageLinks} />
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
}: {
  eventView: EventView;
  enabled?: boolean;
  excludeOther?: boolean;
  initialData?: TableData;
  limit?: number;
  referrer?: string;
  staleTime?: number;
}) {
  const location = useLocation();
  const organization = useOrganization();

  const result = useDiscoverQuery({
    eventView,
    location,
    orgSlug: organization.slug,
    limit: limit ?? 25,
    referrer,
    options: {
      refetchOnWindowFocus: false,
      enabled,
      staleTime,
    },
  });

  return {
    ...result,
    data: result.isLoading ? initialData : result.data,
    pageLinks: result.pageLinks,
  };
}
