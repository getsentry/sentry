import {Fragment, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout/flex';
import {
  JetpackComposePiiNotice,
  useNeedsJetpackComposePiiNotice,
} from 'sentry/components/replays/jetpackComposePiiNotice';
import ReplayTable from 'sentry/components/replays/table/replayTable';
import useReplayTableSort from 'sentry/components/replays/table/useReplayTableSort';
import {usePlaylistQuery} from 'sentry/components/replays/usePlaylistQuery';
import {t, tct} from 'sentry/locale';
import {ListItemCheckboxProvider} from 'sentry/utils/list/useListItemCheckboxState';
import {useQueryClient, type ApiQueryKey} from 'sentry/utils/queryClient';
import {useHaveSelectedProjectsSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import {
  MIN_DEAD_RAGE_CLICK_SDK,
  MIN_REPLAY_CLICK_SDK,
} from 'sentry/utils/replays/sdkVersions';
import type RequestError from 'sentry/utils/requestError/requestError';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';
import useAllMobileProj from 'sentry/views/replays/detail/useAllMobileProj';
import BulkDeleteAlert from 'sentry/views/replays/list/bulkDeleteAlert';
import ReplaysFilters from 'sentry/views/replays/list/filters';
import ReplaysSearch from 'sentry/views/replays/list/search';
import useReplayIndexTableColumns from 'sentry/views/replays/list/useReplayIndexTableColumns';
import DeadRageSelectorCards from 'sentry/views/replays/selectors/deadRageSelectorCards';
import type {ReplayListRecord} from 'sentry/views/replays/types';

interface Props {
  error: RequestError | null | undefined;
  hasMoreResults: boolean;
  isPending: boolean;
  queryKey: ApiQueryKey;
  replays: ReplayListRecord[];
}

export default function ReplayIndexTable({
  error,
  hasMoreResults,
  isPending,
  queryKey,
  replays,
}: Props) {
  const queryClient = useQueryClient();

  const {
    selection: {projects},
  } = usePageFilters();

  const tableRef = useRef<HTMLDivElement>(null);
  const tableDimensions = useDimensions({elementRef: tableRef});

  const rageClicksSdkVersion = useProjectSdkNeedsUpdate({
    minVersion: MIN_DEAD_RAGE_CLICK_SDK.minVersion,
    projectId: projects.map(String),
  });
  const hasSentReplays = useHaveSelectedProjectsSentAnyReplayEvents();
  const isLoading = hasSentReplays.fetching || rageClicksSdkVersion.isFetching;

  const {onSortClick, sortType} = useReplayTableSort();

  const {allMobileProj} = useAllMobileProj({});
  const columns = useReplayIndexTableColumns({allMobileProj, tableDimensions});

  const needsSDKUpdateForClickSearch = useNeedsSDKUpdateForClickSearch({
    search: queryKey[1]?.query?.query,
  });

  const showDeadRageClickCards =
    !rageClicksSdkVersion.needsUpdate && !allMobileProj && !isLoading;

  const [widgetIsOpen, setWidgetIsOpen] = useLocalStorageState(
    `replay-dead-rage-widget-open`,
    true
  );

  const needsJetpackComposePiiWarning = useNeedsJetpackComposePiiNotice({
    replays,
  });

  const playlistQuery = usePlaylistQuery('replayList');

  return (
    <Fragment>
      <Flex gap="md" wrap="wrap">
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
        hits={hasMoreResults ? replays.length + 1 : replays.length}
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
            referrer="main"
            query={playlistQuery}
            ref={tableRef}
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
    </Fragment>
  );
}

function useNeedsSDKUpdateForClickSearch({search}: {search: undefined | string}) {
  const {
    selection: {projects},
  } = usePageFilters();
  const {needsUpdate} = useProjectSdkNeedsUpdate({
    minVersion: MIN_REPLAY_CLICK_SDK.minVersion,
    projectId: projects.map(String),
  });

  return useMemo(() => {
    if (!search) {
      return false;
    }
    const conditions = new MutableSearch(search);
    const isSearchingForClicks = conditions
      .getFilterKeys()
      .some(k => k.startsWith('click.'));

    return needsUpdate && isSearchingForClicks;
  }, [needsUpdate, search]);
}

const EmptyStateSubheading = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
`;
