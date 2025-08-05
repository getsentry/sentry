import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout/flex';
import Pagination from 'sentry/components/pagination';
import {
  JetpackComposePiiNotice,
  useNeedsJetpackComposePiiNotice,
} from 'sentry/components/replays/jetpackComposePiiNotice';
import ReplayTable from 'sentry/components/replays/table/replayTable';
import {
  ReplayActivityColumn,
  ReplayBrowserColumn,
  ReplayCountDeadClicksColumn,
  ReplayCountErrorsColumn,
  ReplayCountRageClicksColumn,
  ReplayDurationColumn,
  ReplayOSColumn,
  ReplaySelectColumn,
  ReplaySessionColumn,
} from 'sentry/components/replays/table/replayTableColumns';
import useReplayTableSort from 'sentry/components/replays/table/useReplayTableSort';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {ListItemCheckboxProvider} from 'sentry/utils/list/useListItemCheckboxState';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useReplayListQueryKey from 'sentry/utils/replays/hooks/useReplayListQueryKey';
import {useHaveSelectedProjectsSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import {
  MIN_DEAD_RAGE_CLICK_SDK,
  MIN_REPLAY_CLICK_SDK,
} from 'sentry/utils/replays/sdkVersions';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';
import useAllMobileProj from 'sentry/views/replays/detail/useAllMobileProj';
import BulkDeleteAlert from 'sentry/views/replays/list/bulkDeleteAlert';
import ReplaysFilters from 'sentry/views/replays/list/filters';
import ReplaysSearch from 'sentry/views/replays/list/search';
import DeadRageSelectorCards from 'sentry/views/replays/selectors/deadRageSelectorCards';
import type {ReplayListRecord} from 'sentry/views/replays/types';

const COLUMNS_WEB = [
  ReplaySelectColumn,
  ReplaySessionColumn,
  ReplayOSColumn,
  ReplayBrowserColumn,
  ReplayDurationColumn,
  ReplayCountDeadClicksColumn,
  ReplayCountRageClicksColumn,
  ReplayCountErrorsColumn,
  ReplayActivityColumn,
] as const;

const COLUMNS_MOBILE = [
  ReplaySelectColumn,
  ReplaySessionColumn,
  ReplayOSColumn,
  ReplayDurationColumn,
  ReplayCountErrorsColumn,
  ReplayActivityColumn,
] as const;

export default function ReplayIndexTable() {
  const queryClient = useQueryClient();
  const organization = useOrganization();

  const {
    selection: {projects},
  } = usePageFilters();

  const rageClicksSdkVersion = useProjectSdkNeedsUpdate({
    minVersion: MIN_DEAD_RAGE_CLICK_SDK.minVersion,
    organization,
    projectId: projects.map(String),
  });
  const hasSentReplays = useHaveSelectedProjectsSentAnyReplayEvents();
  const isLoading = hasSentReplays.fetching || rageClicksSdkVersion.isFetching;

  const {onSortClick, sortQuery, sortType} = useReplayTableSort();
  const query = useLocationQuery({
    fields: {
      cursor: decodeScalar,
      end: decodeScalar,
      environment: decodeList,
      project: decodeList,
      query: decodeScalar,
      start: decodeScalar,
      statsPeriod: decodeScalar,
      utc: decodeScalar,
    },
  });
  const queryKey = useReplayListQueryKey({
    options: {query: {...query, sort: sortQuery}},
    organization,
    queryReferrer: 'replayList',
  });
  const {data, isPending, error, getResponseHeader} = useApiQuery<{
    data: ReplayListRecord[];
    enabled: true;
  }>(queryKey, {staleTime: 0});
  const replays = data?.data?.map(mapResponseToReplayRecord) ?? [];

  const {allMobileProj} = useAllMobileProj({});
  const columns = allMobileProj ? COLUMNS_MOBILE : COLUMNS_WEB;

  const needsSDKUpdateForClickSearch = useNeedsSDKUpdateForClickSearch(query);

  const showDeadRageClickCards =
    !rageClicksSdkVersion.needsUpdate && !allMobileProj && !isLoading;

  const [widgetIsOpen, setWidgetIsOpen] = useLocalStorageState(
    `replay-dead-rage-widget-open`,
    true
  );

  const needsJetpackComposePiiWarning = useNeedsJetpackComposePiiNotice({
    replays,
  });

  const pageLinks = getResponseHeader?.('Link') ?? null;
  const hasNextResultsPage = parseLinkHeader(pageLinks).next?.results;
  const hasPrevResultsPage = parseLinkHeader(pageLinks).prev?.results;

  return (
    <Fragment>
      <Flex gap="xl" wrap="wrap">
        <ReplaysFilters />
        <ReplaysSearch />
        {showDeadRageClickCards ? (
          <Button onClick={() => setWidgetIsOpen(!widgetIsOpen)}>
            {widgetIsOpen ? t('Hide Widgets') : t('Show Widgets')}
          </Button>
        ) : null}
      </Flex>
      {projects.length === 1 ? (
        <BulkDeleteAlert
          projectId={String(projects[0] ?? '')}
          onDidHide={() => queryClient.invalidateQueries({queryKey})}
        />
      ) : null}

      {widgetIsOpen && showDeadRageClickCards ? <DeadRageSelectorCards /> : null}

      {needsJetpackComposePiiWarning && <JetpackComposePiiNotice />}
      <ListItemCheckboxProvider
        hits={
          hasPrevResultsPage || hasNextResultsPage ? replays.length + 1 : replays.length
        }
        knownIds={replays.map(replay => replay.id)}
        queryKey={queryKey}
      >
        {needsSDKUpdateForClickSearch ? (
          <Fragment>
            {t('Unindexed search field')}
            <EmptyStateSubheading>
              {tct('Field [field] requires an [sdkPrompt]', {
                field: <strong>'click'</strong>,
                sdkPrompt: <strong>{t('SDK version >= 7.44.0')}</strong>,
              })}
            </EmptyStateSubheading>
          </Fragment>
        ) : (
          <ReplayTable
            columns={columns}
            error={error}
            isPending={isPending}
            onSortClick={onSortClick}
            replays={replays}
            showDropdownFilters
            sort={sortType}
          />
        )}
      </ListItemCheckboxProvider>
      <Paginate pageLinks={pageLinks} />
    </Fragment>
  );
}

function useNeedsSDKUpdateForClickSearch({query}: {query: string}) {
  const organization = useOrganization();
  const {
    selection: {projects},
  } = usePageFilters();
  const {needsUpdate} = useProjectSdkNeedsUpdate({
    minVersion: MIN_REPLAY_CLICK_SDK.minVersion,
    organization,
    projectId: projects.map(String),
  });

  const conditions = useMemo(() => new MutableSearch(query), [query]);
  const isSearchingForClicks = conditions
    .getFilterKeys()
    .some(k => k.startsWith('click.'));

  return needsUpdate && isSearchingForClicks;
}

function Paginate({pageLinks}: {pageLinks: string | null}) {
  const organization = useOrganization();
  const navigate = useNavigate();

  return (
    <ReplayPagination
      pageLinks={pageLinks}
      onCursor={(cursor, path, searchQuery) => {
        trackAnalytics('replay.list-paginated', {
          organization,
          direction: cursor?.endsWith(':1') ? 'prev' : 'next',
        });
        navigate({
          pathname: path,
          query: {...searchQuery, cursor},
        });
      }}
    />
  );
}

const EmptyStateSubheading = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
`;

const ReplayPagination = styled(Pagination)`
  margin-top: 0;
`;
