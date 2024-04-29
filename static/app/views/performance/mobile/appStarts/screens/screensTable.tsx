import {Fragment} from 'react';
import * as qs from 'query-string';

import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import TopResultsIndicator from 'sentry/views/discover/table/topResultsIndicator';
import Breakdown from 'sentry/views/performance/mobile/appStarts/screens/breakdown';
import {COLD_START_TYPE} from 'sentry/views/performance/mobile/appStarts/screenSummary/startTypeSelector';
import {ScreensTable} from 'sentry/views/performance/mobile/components/screensTable';
import {TOP_SCREENS} from 'sentry/views/performance/mobile/screenload/screens';
import {COLD_START_COLOR, WARM_START_COLOR} from 'sentry/views/starfish/colors';
import {
  PRIMARY_RELEASE_ALIAS,
  SECONDARY_RELEASE_ALIAS,
} from 'sentry/views/starfish/components/releaseSelector';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {SpanMetricsField} from 'sentry/views/starfish/types';

type Props = {
  data: TableData | undefined;
  eventView: EventView;
  isLoading: boolean;
  pageLinks: string | undefined;
};

export function AppStartScreens({data, eventView, isLoading, pageLinks}: Props) {
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
    if (!data) {
      return null;
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
          data-test-id="app-start-breakdown"
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

    return null;
  }

  return (
    <ScreensTable
      columnNameMap={columnNameMap}
      data={data}
      eventView={eventView}
      isLoading={isLoading}
      pageLinks={pageLinks}
      columnOrder={[
        'transaction',
        `avg_if(measurements.app_start_${startType},release,${primaryRelease})`,
        `avg_if(measurements.app_start_${startType},release,${secondaryRelease})`,
        `avg_compare(measurements.app_start_${startType},release,${primaryRelease},${secondaryRelease})`,
        'app_start_breakdown',
        `count_starts(measurements.app_start_${startType})`,
      ]}
      defaultSort={[
        {
          key: `count_starts_measurements_app_start_${startType}`,
          order: 'desc',
        },
      ]}
      customBodyCellRenderer={renderBodyCell}
    />
  );
}
