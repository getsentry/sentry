import {Fragment, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import {useQueryClient} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {
  JetpackComposePiiNotice,
  useNeedsJetpackComposePiiNotice,
} from 'sentry/components/replays/jetpackComposePiiNotice';
import {ReplayTable} from 'sentry/components/replays/table/replayTable';
import {useReplayTableSort} from 'sentry/components/replays/table/useReplayTableSort';
import {usePlaylistQuery} from 'sentry/components/replays/usePlaylistQuery';
import {t, tct} from 'sentry/locale';
import {type ApiQueryKey, parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {ListItemCheckboxProvider} from 'sentry/utils/list/useListItemCheckboxState';
import {MIN_REPLAY_CLICK_SDK} from 'sentry/utils/replays/sdkVersions';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useProjectSdkNeedsUpdate} from 'sentry/utils/useProjectSdkNeedsUpdate';
import {useAllMobileProj} from 'sentry/views/explore/replays/detail/useAllMobileProj';
import {BulkDeleteAlert} from 'sentry/views/explore/replays/list/bulkDeleteAlert';
import {ReplayListControls} from 'sentry/views/explore/replays/list/replayListControls';
import {useReplayIndexTableColumns} from 'sentry/views/explore/replays/list/useReplayIndexTableColumns';
import {DeadRageSelectorCards} from 'sentry/views/explore/replays/selectors/deadRageSelectorCards';
import type {ReplayListRecord} from 'sentry/views/explore/replays/types';

interface Props {
  error: Error | null | undefined;
  hasMoreResults: boolean;
  isPending: boolean;
  onToggleWidgets: () => void;
  queryKey: ApiQueryKey;
  replays: ReplayListRecord[];
  showDeadRageClickCards: boolean;
  widgetIsOpen: boolean;
}

export function ReplayIndexTable({
  error,
  hasMoreResults,
  isPending,
  onToggleWidgets,
  queryKey,
  replays,
  showDeadRageClickCards,
  widgetIsOpen,
}: Props) {
  const queryClient = useQueryClient();

  const {
    selection: {projects},
  } = usePageFilters();

  const tableRef = useRef<HTMLDivElement>(null);
  const tableDimensions = useDimensions({elementRef: tableRef});

  const {onSortClick, sortType} = useReplayTableSort();

  const {allMobileProj} = useAllMobileProj({});
  const columns = useReplayIndexTableColumns({allMobileProj, tableDimensions});

  const {options} = parseQueryKey(queryKey);
  const needsSDKUpdateForClickSearch = useNeedsSDKUpdateForClickSearch({
    search: options?.query?.query,
  });

  const needsJetpackComposePiiWarning = useNeedsJetpackComposePiiNotice({
    replays,
  });

  const playlistQuery = usePlaylistQuery('replayList');

  return (
    <Fragment>
      <ReplayListControls
        onToggleWidgets={onToggleWidgets}
        showDeadRageClickCards={showDeadRageClickCards}
        widgetIsOpen={widgetIsOpen}
      />
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
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
`;
