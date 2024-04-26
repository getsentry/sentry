import type {ComponentProps} from 'react';
import {useMemo} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import type {NewQuery} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {MetricReadout} from 'sentry/views/performance/metricReadout';
import {
  DEFAULT_PLATFORM,
  PLATFORM_LOCAL_STORAGE_KEY,
  PLATFORM_QUERY_PARAM,
} from 'sentry/views/performance/mobile/screenload/screens/platformSelector';
import {useTableQuery} from 'sentry/views/performance/mobile/screenload/screens/screensTable';
import {isCrossPlatform} from 'sentry/views/performance/mobile/screenload/screens/utils';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';

interface BlockProps {
  dataKey: string | ((data?: TableDataRow[]) => number | undefined);
  title: string;
  unit: ComponentProps<typeof MetricReadout>['unit'];
  allowZero?: boolean;
}

export function MetricsRibbon({
  filters,
  project,
  blocks,
  fields,
  referrer,
  dataset,
}: {
  blocks: BlockProps[];
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

  const hasPlatformSelectFeature = organization.features.includes('spans-first-ui');
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

  return (
    <BlockContainer>
      {blocks.map(({title, dataKey, unit}) => (
        <MetricsBlock
          key={title}
          title={title}
          unit={unit}
          dataKey={dataKey}
          data={data}
          isLoading={isLoading}
        />
      ))}
    </BlockContainer>
  );
}

function MetricsBlock({
  title,
  unit,
  data,
  dataKey,
  isLoading,
  allowZero,
}: {
  isLoading: boolean;
  title: string;
  data?: TableData;
  release?: string;
} & BlockProps) {
  const value =
    typeof dataKey === 'function'
      ? dataKey(data?.data)
      : (data?.data?.[0]?.[dataKey] as number);

  const hasData = (value && value !== 0) || (value === 0 && allowZero);

  return (
    <MetricReadout
      title={title}
      align="left"
      value={hasData ? value : undefined}
      isLoading={isLoading}
      unit={unit}
    />
  );
}

const BlockContainer = styled('div')`
  display: flex;
  gap: ${space(2)};
`;
