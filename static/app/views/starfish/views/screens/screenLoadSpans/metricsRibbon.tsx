import {useMemo} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {NewQuery, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {CountCell} from 'sentry/views/starfish/components/tableCells/countCell';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {formatVersionAndCenterTruncate} from 'sentry/views/starfish/utils/centerTruncate';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {DEFAULT_PLATFORM, PLATFORM_LOCAL_STORAGE_KEY, PLATFORM_QUERY_PARAM} from 'sentry/views/starfish/views/screens/platformSelector';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';
import {isCrossPlatform} from 'sentry/views/starfish/views/screens/utils';
import {Block} from 'sentry/views/starfish/views/spanSummaryPage/block';

export function ScreenMetricsRibbon({additionalFilters, project}: {additionalFilters?: string[], project?: Project | null;}) {
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const location = useLocation();

  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const truncatedPrimary = formatVersionAndCenterTruncate(primaryRelease ?? '', 10);
  const truncatedSecondary = formatVersionAndCenterTruncate(secondaryRelease ?? '', 10);

  const hasPlatformSelectFeature = organization.features.includes('performance-screens-platform-selector');
  const platform =
        decodeScalar(location.query[PLATFORM_QUERY_PARAM]) ??
        localStorage.getItem(PLATFORM_LOCAL_STORAGE_KEY) ??
        DEFAULT_PLATFORM;

  const queryString = useMemo(() => {
    const searchQuery = new MutableSearch([
      'event.type:transaction',
      'transaction.op:ui.load',
      ...(additionalFilters ?? []),
    ]);

    if (project && isCrossPlatform(project) && hasPlatformSelectFeature) {
      searchQuery.addFilterValue('os.name', platform);
    }

    return appendReleaseFilters(
      searchQuery,
      primaryRelease,
      secondaryRelease
    );
  }, [additionalFilters, hasPlatformSelectFeature, platform, primaryRelease, project, secondaryRelease]);

  const newQuery: NewQuery = {
    name: 'ScreenMetricsRibbon',
    fields: [
      `avg_if(measurements.time_to_initial_display,release,${primaryRelease})`,
      `avg_if(measurements.time_to_initial_display,release,${secondaryRelease})`,
      `avg_if(measurements.time_to_full_display,release,${primaryRelease})`,
      `avg_if(measurements.time_to_full_display,release,${secondaryRelease})`,
      'count()',
    ],
    query: queryString,
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
