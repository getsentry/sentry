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
import {
  PRIMARY_RELEASE_ALIAS,
  SECONDARY_RELEASE_ALIAS,
} from 'sentry/views/insights/common/components/releaseSelector';
import {OverflowEllipsisTextContainer} from 'sentry/views/insights/common/components/textAlign';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
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

export function UIScreensTable({data, eventView, isLoading, pageLinks}: Props) {
  const moduleURL = useModuleURL('mobile-ui');
  const location = useLocation();
  const {primaryRelease, secondaryRelease} = useReleaseSelection();

  const columnNameMap = {
    transaction: t('Screen'),
    [`division_if(mobile.slow_frames,mobile.total_frames,release,${primaryRelease})`]: t(
      'Slow (%s)',
      PRIMARY_RELEASE_ALIAS
    ),
    [`division_if(mobile.slow_frames,mobile.total_frames,release,${secondaryRelease})`]:
      t('Slow (%s)', SECONDARY_RELEASE_ALIAS),
    [`division_if(mobile.frozen_frames,mobile.total_frames,release,${primaryRelease})`]:
      t('Frozen (%s)', PRIMARY_RELEASE_ALIAS),
    [`division_if(mobile.frozen_frames,mobile.total_frames,release,${secondaryRelease})`]:
      t('Frozen (%s)', SECONDARY_RELEASE_ALIAS),
    [`avg_if(mobile.frames_delay,release,${primaryRelease})`]: t(
      'Delay (%s)',
      PRIMARY_RELEASE_ALIAS
    ),
    [`avg_if(mobile.frames_delay,release,${secondaryRelease})`]: t(
      'Delay (%s)',
      SECONDARY_RELEASE_ALIAS
    ),
    [`avg_compare(mobile.slow_frames,release,${primaryRelease},${secondaryRelease})`]:
      t('Change'),
    [`avg_compare(mobile.frozen_frames,release,${primaryRelease},${secondaryRelease})`]:
      t('Change'),
    [`avg_compare(mobile.frames_delay,release,${primaryRelease},${secondaryRelease})`]:
      t('Change'),
    // TODO: Counts
  };

  const columnTooltipMap = {
    [`division_if(mobile.slow_frames,mobile.total_frames,release,${primaryRelease})`]: t(
      'The number of slow frames divided by total frames (%s)',
      PRIMARY_RELEASE_ALIAS
    ),
    [`division_if(mobile.slow_frames,mobile.total_frames,release,${secondaryRelease})`]:
      t(
        'The number of slow frames divided by total frames (%s)',
        SECONDARY_RELEASE_ALIAS
      ),
    [`division_if(mobile.frozen_frames,mobile.total_frames,release,${primaryRelease})`]:
      t(
        'The number of frozen frames divided by total frames (%s)',
        PRIMARY_RELEASE_ALIAS
      ),
    [`division_if(mobile.frozen_frames,mobile.total_frames,release,${secondaryRelease})`]:
      t(
        'The number of frozen frames divided by total frames (%s)',
        SECONDARY_RELEASE_ALIAS
      ),
    [`avg_if(mobile.frames_delay,release,${primaryRelease})`]: t(
      'The average frame delay (%s)',
      PRIMARY_RELEASE_ALIAS
    ),
    [`avg_if(mobile.frames_delay,release,${secondaryRelease})`]: t(
      'The average frame delay (%s)',
      SECONDARY_RELEASE_ALIAS
    ),
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
          <OverflowEllipsisTextContainer>
            <TopResultsIndicator count={TOP_SCREENS} index={index} />
            <Link
              to={`${moduleURL}/spans/?${qs.stringify({
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
          </OverflowEllipsisTextContainer>
        </Fragment>
      );
    }

    if (field.startsWith('avg_if(mobile.frames_delay')) {
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
      columnTooltipMap={columnTooltipMap}
      data={data}
      eventView={eventView}
      isLoading={isLoading}
      pageLinks={pageLinks}
      columnOrder={[
        'transaction',
        `division_if(mobile.slow_frames,mobile.total_frames,release,${primaryRelease})`,
        `division_if(mobile.slow_frames,mobile.total_frames,release,${secondaryRelease})`,
        `division_if(mobile.frozen_frames,mobile.total_frames,release,${primaryRelease})`,
        `division_if(mobile.frozen_frames,mobile.total_frames,release,${secondaryRelease})`,
        `avg_if(mobile.frames_delay,release,${primaryRelease})`,
        `avg_if(mobile.frames_delay,release,${secondaryRelease})`,
        `avg_compare(mobile.frames_delay,release,${primaryRelease},${secondaryRelease})`,
      ]}
      // TODO: Add default sort on count column
      defaultSort={[
        {
          key: `avg_compare(mobile.frames_delay,release,${primaryRelease},${secondaryRelease})`,
          order: 'desc',
        },
      ]}
      customBodyCellRenderer={renderBodyCell}
      moduleName={ModuleName.MOBILE_UI}
    />
  );
}
