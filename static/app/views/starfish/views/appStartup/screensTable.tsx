import {Fragment} from 'react';
import * as qs from 'query-string';

import type {GridColumnHeader} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import type {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {MetaType} from 'sentry/utils/discover/eventView';
import type EventView from 'sentry/utils/discover/eventView';
import {isFieldSortable} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import TopResultsIndicator from 'sentry/views/discover/table/topResultsIndicator';
import {COLD_START_COLOR, WARM_START_COLOR} from 'sentry/views/starfish/colours';
import {
  PRIMARY_RELEASE_ALIAS,
  SECONDARY_RELEASE_ALIAS,
} from 'sentry/views/starfish/components/releaseSelector';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import Breakdown from 'sentry/views/starfish/views/appStartup/breakdown';
import {COLD_START_TYPE} from 'sentry/views/starfish/views/appStartup/screenSummary/startTypeSelector';
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
  const {primaryRelease, secondaryRelease} = useReleaseSelection();

  const startType =
    decodeScalar(location.query[SpanMetricsField.APP_START_TYPE]) ?? COLD_START_TYPE;

  const columnNameMap = {
    transaction: t('Screen'),
    [`avg_if(measurements.app_start_cold,release,${primaryRelease})`]: t(
      'Cold Start (%s)',
      PRIMARY_RELEASE_ALIAS
    ),
    [`avg_if(measurements.app_start_cold,release,${secondaryRelease})`]: t(
      'Cold Start (%s)',
      SECONDARY_RELEASE_ALIAS
    ),
    [`avg_if(measurements.app_start_warm,release,${primaryRelease})`]: t(
      'Warm Start (%s)',
      PRIMARY_RELEASE_ALIAS
    ),
    [`avg_if(measurements.app_start_warm,release,${secondaryRelease})`]: t(
      'Warm Start (%s)',
      SECONDARY_RELEASE_ALIAS
    ),
    [`avg_compare(measurements.app_start_cold,release,${primaryRelease},${secondaryRelease})`]:
      t('Change'),
    [`avg_compare(measurements.app_start_warm,release,${primaryRelease},${secondaryRelease})`]:
      t('Change'),
    app_start_breakdown: t('Type Breakdown'),
    'count_starts(measurements.app_start_cold)': t('Count'),
    'count_starts(measurements.app_start_warm)': t('Count'),
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
              }/performance/mobile/app-startup/spans/?${qs.stringify({
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
      return (
        <Breakdown
          row={row}
          breakdownGroups={[
            {
              key: 'count_starts(measurements.app_start_cold)',
              color: COLD_START_COLOR,
              name: t('Cold Start'),
            },
            {
              key: 'count_starts(measurements.app_start_warm)',
              color: WARM_START_COLOR,
              name: t('Warm Start'),
            },
          ]}
        />
      );
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
          `avg_if(measurements.app_start_${startType},release,${primaryRelease})`,
          `avg_if(measurements.app_start_${startType},release,${secondaryRelease})`,
          `avg_compare(measurements.app_start_${startType},release,${primaryRelease},${secondaryRelease})`,
          'app_start_breakdown',
          `count_starts(measurements.app_start_${startType})`,
        ].map(columnKey => {
          return {
            key: columnKey,
            name: columnNameMap[columnKey],
            width: COL_WIDTH_UNDEFINED,
          };
        })}
        columnSortBy={[
          {
            key: `count_starts_measurements_app_start_${startType}`,
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
