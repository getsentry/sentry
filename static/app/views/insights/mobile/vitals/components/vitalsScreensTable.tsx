import {Fragment} from 'react';
import * as qs from 'query-string';

import Duration from 'sentry/components/duration';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type EventView from 'sentry/utils/discover/eventView';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {useLocation} from 'sentry/utils/useLocation';
import TopResultsIndicator from 'sentry/views/discover/table/topResultsIndicator';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {ScreensTable} from 'sentry/views/insights/mobile/common/components/tables/screensTable';
import {TOP_SCREENS} from 'sentry/views/insights/mobile/constants';
import {ModuleName} from 'sentry/views/insights/types';

type Props = {
  data: TableData | undefined;
  eventView: EventView;
  isLoading: boolean;
  pageLinks: string | undefined;
};

function VitalsScreensTable({data, eventView, isLoading, pageLinks}: Props) {
  const moduleURL = useModuleURL('mobile-vitals');
  const location = useLocation();

  const columnNameMap = {
    transaction: t('Screen'),
    [`count()`]: t('Screen Loads'),
    [`avg(mobile.slow_frames)`]: t('Slow Frames'),
    [`avg(mobile.frozen_frames)`]: t('Frozen Frames'),
    [`avg(mobile.frames_delay)`]: t('Frame Delay'),
  };

  function renderBodyCell(column, row): React.ReactNode | null {
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
            to={`${moduleURL}/screens/?${qs.stringify({
              ...location.query,
              project: row['project.id'],
              transaction: row.transaction,
            })}`}
            style={{display: `block`, width: `100%`}}
          >
            {row.transaction}
          </Link>
        </Fragment>
      );
    }

    if (field.startsWith('avg(mobile.frames_delay')) {
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
        `avg(mobile.frames_delay)`,
        `count()`,
      ]}
      // TODO: Add default sort on count column
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

export default VitalsScreensTable;
