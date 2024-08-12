import {Fragment} from 'react';
import * as qs from 'query-string';

import Duration from 'sentry/components/duration';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type EventView from 'sentry/utils/discover/eventView';
import {NumberContainer} from 'sentry/utils/discover/styles';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {OverflowEllipsisTextContainer} from 'sentry/views/insights/common/components/textAlign';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {ScreensTable} from 'sentry/views/insights/mobile/common/components/tables/screensTable';
import {ModuleName} from 'sentry/views/insights/types';

type Props = {
  data: TableData | undefined;
  eventView: EventView;
  isLoading: boolean;
  pageLinks: string | undefined;
};

function ScreensOverviewTable({data, eventView, isLoading, pageLinks}: Props) {
  const moduleURL = useModuleURL('mobile-screens');
  const location = useLocation();

  const columnNameMap = {
    transaction: t('Screen'),
    [`count()`]: t('Screen Loads'),
    [`avg(mobile.slow_frames)`]: t('Slow Frames'),
    [`avg(mobile.frozen_frames)`]: t('Frozen Frames'),
    [`avg(measurements.time_to_initial_display)`]: t('TTID'),
    [`avg(measurements.time_to_full_display)`]: t('TTFD'),
    ['avg(measurements.app_start_warm)']: t('Warm Start'),
    ['avg(measurements.app_start_cold)']: t('Cold Start'),
  };

  function renderBodyCell(column, row): React.ReactNode | null {
    if (!data) {
      return null;
    }
    const field = String(column.key);

    if (field === 'transaction') {
      const link = normalizeUrl(
        `${moduleURL}/details/?${qs.stringify({
          ...location.query,
          project: row['project.id'],
          transaction: row.transaction,
        })}`
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

    // backend doesn't provide unit for frames_delay, manually format it right now
    if (field === `avg(mobile.frames_delay)`) {
      return (
        <NumberContainer>
          {row[field] ? (
            <Duration seconds={row[field]} fixedDigits={2} abbreviation />
          ) : (
            '-'
          )}
        </NumberContainer>
      );
    }

    return null;
  }

  return (
    <ScreensTable
      columnNameMap={columnNameMap}
      columnTooltipMap={{}}
      data={data}
      eventView={eventView}
      isLoading={isLoading}
      pageLinks={pageLinks}
      columnOrder={[
        'transaction',
        `avg(mobile.slow_frames)`,
        `avg(mobile.frozen_frames)`,
        `avg(measurements.time_to_initial_display)`,
        `avg(measurements.time_to_full_display)`,
        'avg(measurements.app_start_cold)',
        'avg(measurements.app_start_warm)',
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
