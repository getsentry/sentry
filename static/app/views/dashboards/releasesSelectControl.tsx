import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import chunk from 'lodash/chunk';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';

import {Flex} from '@sentry/scraps/layout';

import {Badge} from 'sentry/components/core/badge';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {DateTime} from 'sentry/components/dateTime';
import TextOverflow from 'sentry/components/textOverflow';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconReleases} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {NewQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useQueries} from 'sentry/utils/queryClient';
import {useReleases} from 'sentry/utils/releases/releasesProvider';
import {escapeFilterValue} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  SORT_BY_OPTIONS,
  type ReleasesSortByOption,
} from 'sentry/views/insights/common/components/releasesSort';

import type {DashboardFilters} from './types';
import {DashboardFilterKeys} from './types';

type Props = {
  selectedReleases: string[];
  sortBy: ReleasesSortByOption;
  className?: string;
  handleChangeFilter?: (activeFilters: DashboardFilters) => void;
  id?: string;
  isDisabled?: boolean;
};

const ALIASED_RELEASES = [
  {
    label: t('Latest Release(s)'),
    value: 'latest',
    tooltip: t(
      'The highest version number for Semantic Versioning or the most recent release for commit SHA.'
    ),
  },
];

type LabelDetailsProps = {
  dateCreated?: string;
  eventCount?: number;
};

function LabelDetails(props: LabelDetailsProps) {
  return (
    <Flex justify="space-between" gap="sm" style={{minWidth: 200}}>
      <div>
        {defined(props.eventCount)
          ? tn('%s event', '%s events', props.eventCount)
          : t('No events')}
      </div>
      <div>
        {defined(props.dateCreated) && (
          <DateTime dateOnly year date={props.dateCreated} />
        )}
      </div>
    </Flex>
  );
}

function ReleasesSelectControl({
  handleChangeFilter,
  selectedReleases,
  sortBy,
  className,
  isDisabled,
  id,
}: Props) {
  const {releases, loading, onSearch} = useReleases();
  const [activeReleases, setActiveReleases] = useState<string[]>(selectedReleases);
  const organization = useOrganization();
  const location = useLocation();
  const api = useApi();
  const {selection, isReady} = usePageFilters();

  // Fetch event counts for releases
  const chunks = releases?.length ? chunk(releases, 10) : [];
  const releaseMetrics = useQueries({
    queries: chunks.map(releaseChunk => {
      const newQuery: NewQuery = {
        name: '',
        fields: ['release', 'count()'],
        query: `transaction.op:[ui.load,navigation] ${escapeFilterValue(
          `release:[${releaseChunk.map(r => `"${r.version}"`).join()}]`
        )}`,
        dataset: DiscoverDatasets.SPANS,
        version: 2,
        projects: selection.projects,
      };
      const eventView = EventView.fromNewQueryWithPageFilters(newQuery, selection);
      const queryKey = [
        `/organizations/${organization.slug}/events/`,
        {
          query: {
            ...eventView.getEventsAPIPayload(location),
            referrer: 'api.dashboards-release-selector',
          },
        },
      ] as ApiQueryKey;
      return {
        queryKey,
        queryFn: () =>
          api.requestPromise(queryKey[0], {
            method: 'GET',
            query: queryKey[1]?.query,
          }) as Promise<TableData>,
        staleTime: Infinity,
        enabled: isReady && !loading,
        retry: false,
      };
    }),
  });

  const metricsFetched = releaseMetrics.every(result => result.isFetched);

  // Create a map of release version to event counts
  const metricsStats: Record<string, {count: number}> = {};
  if (metricsFetched) {
    releaseMetrics.forEach(c =>
      c.data?.data?.forEach(release => {
        metricsStats[release.release!] = {count: release['count()'] as number};
      })
    );
  }

  function resetSearch() {
    onSearch('');
  }

  useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
    setActiveReleases(selectedReleases);
  }, [selectedReleases]);

  const triggerLabel = activeReleases.length ? (
    <TextOverflow>{activeReleases[0]} </TextOverflow>
  ) : (
    t('All Releases')
  );

  const activeReleasesSet = new Set(activeReleases);

  return (
    <StyledCompactSelect
      multiple
      clearable
      searchable
      id={id}
      disabled={isDisabled}
      loading={loading}
      menuTitle={<MenuTitleWrapper>{t('Filter Releases')}</MenuTitleWrapper>}
      className={className}
      onSearch={debounce(val => {
        onSearch(val);
      }, DEFAULT_DEBOUNCE_DURATION)}
      options={[
        {
          value: '_releases',
          label: tct('Sorted by [sortBy]', {
            sortBy: SORT_BY_OPTIONS[sortBy].label,
          }),
          options: [
            ...ALIASED_RELEASES,
            ...activeReleases
              .filter(version => version !== 'latest')
              .map(version => {
                // Find the release in the releases array to get dateCreated
                const release = releases.find(r => r.version === version);
                const eventCount = metricsStats[version]?.count;
                return {
                  label: version,
                  value: version,
                  details: (
                    <LabelDetails
                      eventCount={eventCount}
                      dateCreated={release?.dateCreated}
                    />
                  ),
                };
              }),
            ...releases
              .filter(({version}) => !activeReleasesSet.has(version))
              .map(({version, dateCreated}) => {
                const eventCount = metricsStats[version]?.count;
                return {
                  label: version,
                  value: version,
                  details: (
                    <LabelDetails eventCount={eventCount} dateCreated={dateCreated} />
                  ),
                };
              }),
          ],
        },
      ]}
      onChange={opts => setActiveReleases(opts.map(opt => opt.value as string))}
      onClose={() => {
        resetSearch();
        if (!isEqual(activeReleases, selectedReleases)) {
          handleChangeFilter?.({
            [DashboardFilterKeys.RELEASE]: activeReleases,
          });
        }
      }}
      value={activeReleases}
      triggerProps={{
        icon: <IconReleases />,
        children: (
          <ButtonLabelWrapper>
            {triggerLabel}{' '}
            {activeReleases.length > 1 && (
              <StyledBadge variant="muted">{`+${activeReleases.length - 1}`}</StyledBadge>
            )}
          </ButtonLabelWrapper>
        ),
      }}
    />
  );
}

export default ReleasesSelectControl;

const StyledBadge = styled(Badge)`
  flex-shrink: 0;
`;

const StyledCompactSelect = styled(CompactSelect)`
  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    max-width: 300px;
  }
`;

const ButtonLabelWrapper = styled('span')`
  width: 100%;
  text-align: left;
  align-items: center;
  display: inline-grid;
  grid-template-columns: 1fr auto;
`;

const MenuTitleWrapper = styled('span')`
  display: inline-block;
  padding-top: ${space(0.5)};
  padding-bottom: ${space(0.5)};
`;
