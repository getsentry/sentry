import {useMemo} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import type {NewQuery, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import type {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {CountCell} from 'sentry/views/starfish/components/tableCells/countCell';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {
  DEFAULT_PLATFORM,
  PLATFORM_LOCAL_STORAGE_KEY,
  PLATFORM_QUERY_PARAM,
} from 'sentry/views/starfish/views/screens/platformSelector';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';
import {isCrossPlatform} from 'sentry/views/starfish/views/screens/utils';
import {Block} from 'sentry/views/starfish/views/spanSummaryPage/block';

const UNDEFINED_TEXT = '--';

export function MetricsRibbon({
  filters,
  project,
  blocks,
  fields,
  referrer,
  dataset,
}: {
  blocks: {
    dataKey: string | ((data?: TableDataRow[]) => number | undefined);
    title: string;
    type: 'duration' | 'count';
  }[];
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

  return (
    <BlockContainer>
      {blocks.map(({title, dataKey, type}) => (
        <MetricsBlock
          key={title}
          title={title}
          type={type}
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
  type,
  data,
  dataKey,
  isLoading,
}: {
  dataKey: string | ((data?: TableDataRow[]) => number | undefined);
  isLoading: boolean;
  title: string;
  type: 'duration' | 'count';
  data?: TableData;
  release?: string;
}) {
  const value =
    typeof dataKey === 'function'
      ? dataKey(data?.data)
      : (data?.data?.[0]?.[dataKey] as number);

  if (type === 'duration') {
    return (
      <Block title={title}>
        {!isLoading && data && defined(value) ? (
          <DurationCell milliseconds={value} />
        ) : (
          UNDEFINED_TEXT
        )}
      </Block>
    );
  }

  return (
    <Block title={title}>
      {!isLoading && data && defined(value) ? (
        <CountCell count={value} />
      ) : (
        UNDEFINED_TEXT
      )}
    </Block>
  );
}

const BlockContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(5, minmax(40px, max-content));
  gap: ${space(2)};
`;
