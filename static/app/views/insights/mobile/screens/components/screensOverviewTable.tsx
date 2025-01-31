import {Fragment} from 'react';
import * as qs from 'query-string';

import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type EventView from 'sentry/utils/discover/eventView';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {OverflowEllipsisTextContainer} from 'sentry/views/insights/common/components/textAlign';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {ScreensTable} from 'sentry/views/insights/mobile/common/components/tables/screensTable';
import {SUMMARY_PAGE_BASE_URL} from 'sentry/views/insights/mobile/screenRendering/settings';
import {isModuleEnabled} from 'sentry/views/insights/pages/utils';
import {ModuleName} from 'sentry/views/insights/types';

type Props = {
  data: TableData | undefined;
  eventView: EventView;
  isLoading: boolean;
  pageLinks: string | undefined;
};

function ScreensOverviewTable({data, eventView, isLoading, pageLinks}: Props) {
  const moduleURL = useModuleURL(ModuleName.MOBILE_VITALS);
  const screenRenderingModuleUrl = useModuleURL(ModuleName.SCREEN_RENDERING);

  const organization = useOrganization();
  const location = useLocation();

  const isMobileScreensEnabled = isModuleEnabled(ModuleName.MOBILE_VITALS, organization);

  const columnNameMap = {
    transaction: t('Screen'),
    [`count()`]: t('Screen Loads'),
    [`division(mobile.slow_frames,mobile.total_frames)`]: t('Slow Frame Rate'),
    [`division(mobile.frozen_frames,mobile.total_frames)`]: t('Frozen Frame Rate'),
    [`avg(mobile.frames_delay)`]: t('Frame Delay'),
    [`avg(measurements.time_to_initial_display)`]: t('TTID'),
    [`avg(measurements.time_to_full_display)`]: t('TTFD'),
    ['avg(measurements.app_start_warm)']: t('Warm Start'),
    ['avg(measurements.app_start_cold)']: t('Cold Start'),
  };
  const columnTooltipMap = {
    ['avg(measurements.app_start_cold)']: t('Average Cold Start duration'),
    [`avg(measurements.app_start_warm)`]: t('Average Warm Start duration'),
    [`division(mobile.slow_frames,mobile.total_frames)`]: t('Slow Frame Rate'),
    [`division(mobile.frozen_frames,mobile.total_frames)`]: t('Frozen Frame Rate'),
    [`avg(mobile.frames_delay)`]: t('Average Frame Delay'),
    [`avg(measurements.time_to_initial_display)`]: t('Average Time to Initial Display'),
    [`avg(measurements.time_to_full_display)`]: t('Average Time to Full Display'),
  };

  function renderBodyCell(column: any, row: any): React.ReactNode | null {
    if (!data) {
      return null;
    }
    const field = String(column.key);

    if (field === 'transaction') {
      const queryString = qs.stringify({
        ...location.query,
        project: row['project.id'],
        transaction: row.transaction,
      });

      const link = isMobileScreensEnabled
        ? normalizeUrl(`${moduleURL}/details/?${queryString}`)
        : normalizeUrl(
            `${screenRenderingModuleUrl}/${SUMMARY_PAGE_BASE_URL}/?${queryString}`
          );

      return (
        <Fragment>
          <OverflowEllipsisTextContainer>
            <Link to={link} style={{display: `block`, width: `100%`}}>
              {row.transaction}
            </Link>
          </OverflowEllipsisTextContainer>
        </Fragment>
      );
    }

    if (
      field === 'division(mobile.slow_frames,mobile.total_frames)' ||
      field === 'division(mobile.frozen_frames,mobile.total_frames)'
    ) {
      if (isFinite(row[field])) {
        return (
          <NumberContainer>
            {row[field] ? formatPercentage(row[field], 2, {minimumValue: 0.0001}) : '-'}
          </NumberContainer>
        );
      }
    }

    if (
      field === 'division(mobile.slow_frames,mobile.total_frames)' ||
      field === 'division(mobile.frozen_frames,mobile.total_frames)'
    ) {
      if (isFinite(row[field])) {
        return (
          <NumberContainer>
            {row[field] ? formatPercentage(row[field], 2, {minimumValue: 0.0001}) : '-'}
          </NumberContainer>
        );
      }
    }

    return null;
  }

  return (
    <ScreensTable
      columnNameMap={columnNameMap}
      columnTooltipMap={columnTooltipMap}
      data={data}
      eventView={eventView}
      isLoading={isLoading}
      pageLinks={pageLinks}
      columnOrder={[
        'transaction',
        'avg(measurements.app_start_cold)',
        'avg(measurements.app_start_warm)',
        `division(mobile.slow_frames,mobile.total_frames)`,
        `division(mobile.frozen_frames,mobile.total_frames)`,
        `avg(mobile.frames_delay)`,
        `avg(measurements.time_to_initial_display)`,
        `avg(measurements.time_to_full_display)`,
        `count()`,
      ]}
      defaultSort={[
        {
          key: `count()`,
          order: 'desc',
        },
      ]}
      customBodyCellRenderer={renderBodyCell}
      moduleName={ModuleName.MOBILE_UI}
    />
  );
}

export default ScreensOverviewTable;
