import {useMemo} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {NewQuery, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {DurationUnit} from 'sentry/utils/discover/fields';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {MetricReadout} from 'sentry/views/performance/metricReadout';
import {
  PRIMARY_RELEASE_ALIAS,
  SECONDARY_RELEASE_ALIAS,
} from 'sentry/views/starfish/components/releaseSelector';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {
  DEFAULT_PLATFORM,
  PLATFORM_LOCAL_STORAGE_KEY,
  PLATFORM_QUERY_PARAM,
} from 'sentry/views/starfish/views/screens/platformSelector';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';
import {isCrossPlatform} from 'sentry/views/starfish/views/screens/utils';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

export function MetricsRibbon({
  filters,
  project,
  fields,
  referrer,
  dataset,
}: {
  dataset: DiscoverDatasets;
  fields: string[];
  referrer: string;
  filters?: string[];
  project?: Project | null;
}) {
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const location = useLocation();

  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const hasPlatformSelectFeature = organization.features.includes(
    'performance-screens-platform-selector'
  );
  const platform =
    decodeScalar(location.query[PLATFORM_QUERY_PARAM]) ??
    localStorage.getItem(PLATFORM_LOCAL_STORAGE_KEY) ??
    DEFAULT_PLATFORM;

  const queryString = useMemo(() => {
    const searchQuery = new MutableSearch([...(filters ?? [])]);

    if (project && isCrossPlatform(project) && hasPlatformSelectFeature) {
      searchQuery.addFilterValue('os.name', platform);
    }

    return appendReleaseFilters(searchQuery, primaryRelease, secondaryRelease);
  }, [
    filters,
    hasPlatformSelectFeature,
    platform,
    primaryRelease,
    project,
    secondaryRelease,
  ]);

  const newQuery: NewQuery = {
    name: 'ScreenMetricsRibbon',
    fields,
    query: queryString,
    dataset,
    version: 2,
    projects: selection.projects,
  };
  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);
  const {data, isLoading} = useTableQuery({
    eventView,
    enabled: !isReleasesLoading,
    referrer,
  });

  const ribbonData = data?.data?.[0];

  return (
    <BlockContainer>
      <MetricReadout
        title={t('TTID (%s)', PRIMARY_RELEASE_ALIAS)}
        unit={DurationUnit.MILLISECOND}
        value={
          ribbonData?.[
            `avg_if(measurements.time_to_initial_display,release,${primaryRelease})`
          ]
        }
        isLoading={isLoading}
      />

      <MetricReadout
        title={t('TTID (%s)', SECONDARY_RELEASE_ALIAS)}
        unit={DurationUnit.MILLISECOND}
        value={
          ribbonData?.[
            `avg_if(measurements.time_to_initial_display,release,${secondaryRelease})`
          ]
        }
        isLoading={isLoading}
      />

      <MetricReadout
        title={t('TTFD (%s)', PRIMARY_RELEASE_ALIAS)}
        unit={DurationUnit.MILLISECOND}
        value={
          ribbonData?.[
            `avg_if(measurements.time_to_full_display,release,${primaryRelease})`
          ]
        }
        isLoading={isLoading}
      />

      <MetricReadout
        title={t('TTFD (%s)', SECONDARY_RELEASE_ALIAS)}
        unit={DurationUnit.MILLISECOND}
        value={
          ribbonData?.[
            `avg_if(measurements.time_to_full_display,release,${secondaryRelease})`
          ]
        }
        isLoading={isLoading}
      />

      <MetricReadout
        title={DataTitles.count}
        unit={'count'}
        value={ribbonData?.[`count()`]}
        isLoading={isLoading}
      />
    </BlockContainer>
  );
}

const BlockContainer = styled('div')`
  display: flex;
  gap: ${space(2)};
`;
