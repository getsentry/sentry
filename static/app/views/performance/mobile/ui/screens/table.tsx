import {Fragment} from 'react';
import * as qs from 'query-string';

import Duration from 'sentry/components/duration';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type EventView from 'sentry/utils/discover/eventView';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import TopResultsIndicator from 'sentry/views/discover/table/topResultsIndicator';
import {ScreensTable} from 'sentry/views/performance/mobile/components/screensTable';
import {TOP_SCREENS} from 'sentry/views/performance/mobile/screenload/screens';
import {
  PRIMARY_RELEASE_ALIAS,
  SECONDARY_RELEASE_ALIAS,
} from 'sentry/views/starfish/components/releaseSelector';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';

type Props = {
  data: TableData | undefined;
  eventView: EventView;
  isLoading: boolean;
  pageLinks: string | undefined;
};

export function UIScreensTable({data, eventView, isLoading, pageLinks}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const {primaryRelease, secondaryRelease} = useReleaseSelection();

  const columnNameMap = {
    transaction: t('Screen'),
    [`avg_if(mobile.slow_frames,release,${primaryRelease})`]: t(
      'Slow (%s)',
      PRIMARY_RELEASE_ALIAS
    ),
    [`avg_if(mobile.slow_frames,release,${secondaryRelease})`]: t(
      'Slow (%s)',
      SECONDARY_RELEASE_ALIAS
    ),
    [`avg_if(mobile.frozen_frames,release,${primaryRelease})`]: t(
      'Frozen (%s)',
      PRIMARY_RELEASE_ALIAS
    ),
    [`avg_if(mobile.frozen_frames,release,${secondaryRelease})`]: t(
      'Frozen (%s)',
      SECONDARY_RELEASE_ALIAS
    ),
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
            to={normalizeUrl(
              `/organizations/${
                organization.slug
              }/performance/mobile/ui/spans/?${qs.stringify({
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
      data={data}
      eventView={eventView}
      isLoading={isLoading}
      pageLinks={pageLinks}
      columnOrder={[
        'transaction',
        `avg_if(mobile.slow_frames,release,${primaryRelease})`,
        `avg_if(mobile.slow_frames,release,${secondaryRelease})`,
        `avg_compare(mobile.slow_frames,release,${primaryRelease},${secondaryRelease})`,
        `avg_if(mobile.frozen_frames,release,${primaryRelease})`,
        `avg_if(mobile.frozen_frames,release,${secondaryRelease})`,
        `avg_compare(mobile.frozen_frames,release,${primaryRelease},${secondaryRelease})`,
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
    />
  );
}
