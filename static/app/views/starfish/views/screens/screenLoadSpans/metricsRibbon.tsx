import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {NewQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {CountCell} from 'sentry/views/starfish/components/tableCells/countCell';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {formatVersionAndCenterTruncate} from 'sentry/views/starfish/utils/centerTruncate';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';
import {Block} from 'sentry/views/starfish/views/spanSummaryPage/block';

export function ScreenMetricsRibbon({additionalFilters}: {additionalFilters?: string[]}) {
  const {selection} = usePageFilters();
  const location = useLocation();
  const searchQuery = new MutableSearch([
    'event.type:transaction',
    'transaction.op:ui.load',
    ...(additionalFilters ?? []),
  ]);

  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const truncatedPrimary = formatVersionAndCenterTruncate(primaryRelease ?? '', 10);
  const truncatedSecondary = formatVersionAndCenterTruncate(secondaryRelease ?? '', 10);

  const queryStringPrimary = appendReleaseFilters(
    searchQuery,
    primaryRelease,
    secondaryRelease
  );
  const newQuery: NewQuery = {
    name: 'ScreenMetricsRibbon',
    fields: [
      `avg_if(measurements.time_to_initial_display,release,${primaryRelease})`,
      `avg_if(measurements.time_to_initial_display,release,${secondaryRelease})`,
      `avg_if(measurements.time_to_full_display,release,${primaryRelease})`,
      `avg_if(measurements.time_to_full_display,release,${secondaryRelease})`,
      'count()',
    ],
    query: queryStringPrimary,
    dataset: DiscoverDatasets.METRICS,
    version: 2,
    projects: selection.projects,
  };
  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);
  const {data, isLoading} = useTableQuery({
    eventView,
    enabled: !isReleasesLoading,
    referrer: 'api.starfish.mobile-screen-totals',
  });

  const undefinedText = '--';

  return (
    <BlockContainer>
      <Block title={t('TTID (%s)', truncatedPrimary)}>
        {!isLoading && data ? (
          <DurationCell
            milliseconds={
              data.data[0]?.[
                `avg_if(measurements.time_to_initial_display,release,${primaryRelease})`
              ] as number
            }
          />
        ) : (
          undefinedText
        )}
      </Block>
      <Block title={t('TTID (%s)', truncatedSecondary)}>
        {!isLoading && data ? (
          <DurationCell
            milliseconds={
              data.data[0]?.[
                `avg_if(measurements.time_to_initial_display,release,${secondaryRelease})`
              ] as number
            }
          />
        ) : (
          undefinedText
        )}
      </Block>
      <Block title={t('TTFD (%s)', truncatedPrimary)}>
        {!isLoading && data ? (
          <DurationCell
            milliseconds={
              data.data[0]?.[
                `avg_if(measurements.time_to_full_display,release,${primaryRelease})`
              ] as number
            }
          />
        ) : (
          undefinedText
        )}
      </Block>
      <Block title={t('TTFD (%s)', truncatedSecondary)}>
        {!isLoading && data ? (
          <DurationCell
            milliseconds={
              data.data[0]?.[
                `avg_if(measurements.time_to_full_display,release,${secondaryRelease})`
              ] as number
            }
          />
        ) : (
          undefinedText
        )}
      </Block>
      <Block title={t('Count')}>
        {!isLoading && data ? (
          <CountCell count={data.data[0]?.['count()'] as number} />
        ) : (
          undefinedText
        )}
      </Block>
    </BlockContainer>
  );
}

const BlockContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(5, minmax(40px, max-content));
  gap: ${space(2)};
`;
