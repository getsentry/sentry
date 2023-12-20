import {Fragment} from 'react';
import * as qs from 'query-string';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView, {isFieldSortable, MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import TopResultsIndicator from 'sentry/views/discover/table/topResultsIndicator';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {formatVersionAndCenterTruncate} from 'sentry/views/starfish/utils/centerTruncate';
import AppStartBreakdown from 'sentry/views/starfish/views/appStartup/appStartBreakdown';
import {TOP_SCREENS} from 'sentry/views/starfish/views/screens';

const MAX_TABLE_RELEASE_CHARS = 15;

type Props = {
  data: TableData | undefined;
  eventView: EventView;
  isLoading: boolean;
  pageLinks: string | undefined;
};

export function ScreensTable({data, eventView, isLoading, pageLinks}: Props) {
  const location = useLocation();
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

  const columnNameMap = {
    transaction: t('Screen'),
    [`avg_if(measurements.app_start_cold,release,${primaryRelease})`]: t(
      'Cold Start (%s)',
      truncatedPrimary
    ),
    [`avg_if(measurements.app_start_cold,release,${secondaryRelease})`]: t(
      'Cold Start (%s)',
      truncatedSecondary
    ),
    [`avg_if(measurements.app_start_warm,release,${primaryRelease})`]: t(
      'Warm Start (%s)',
      truncatedPrimary
    ),
    [`avg_if(measurements.app_start_warm,release,${secondaryRelease})`]: t(
      'Warm Start (%s)',
      truncatedSecondary
    ),
    app_start_breakdown: t('App Start Breakdown'),
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
              }/starfish/appStartup/spans/?${qs.stringify({
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

    if (field === 'app_start_breakdown') {
      return <AppStartBreakdown row={row} />;
    }

    const renderer = getFieldRenderer(column.key, data?.meta.fields, false);
    return renderer(row, {
      location,
      organization,
      unit: data?.meta.units?.[column.key],
    });
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
        columnOrder={[
          'transaction',
          `avg_if(measurements.app_start_cold,release,${primaryRelease})`,
          `avg_if(measurements.app_start_cold,release,${secondaryRelease})`,
          `avg_if(measurements.app_start_warm,release,${primaryRelease})`,
          `avg_if(measurements.app_start_warm,release,${secondaryRelease})`,
          `app_start_breakdown`,
          'count()',
        ].map(columnKey => {
          return {
            key: columnKey,
            name: columnNameMap[columnKey],
            width: COL_WIDTH_UNDEFINED,
          };
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
