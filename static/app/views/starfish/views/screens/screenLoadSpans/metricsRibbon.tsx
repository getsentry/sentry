import {useMemo} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import type {NewQuery, Project} from 'sentry/types';
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
import {PercentChangeCell} from 'sentry/views/starfish/components/tableCells/percentChangeCell';
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
type BlockType = 'duration' | 'count' | 'change';

interface BlockProps {
  dataKey: string | ((data?: TableDataRow[]) => number | undefined);
  title: string;
  type: BlockType;
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

  const hasData = (!isLoading && value && value !== 0) || (value === 0 && allowZero);

  if (type === 'duration') {
    return (
      <Block title={title}>
        {hasData ? <DurationCell milliseconds={value} /> : UNDEFINED_TEXT}
      </Block>
    );
  }

  if (type === 'change') {
    return (
      <Block title={title}>
        {hasData ? <PercentChangeCell colorize deltaValue={value} /> : UNDEFINED_TEXT}
      </Block>
    );
  }

  return (
    <Block title={title}>{hasData ? <CountCell count={value} /> : UNDEFINED_TEXT}</Block>
  );
}

const BlockContainer = styled('div')`
  display: flex;
  gap: ${space(2)};
`;
