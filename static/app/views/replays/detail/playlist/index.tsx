import ReplayTable from 'sentry/components/replays/table/replayTable';
import {
  ReplayBrowserColumn,
  ReplayCountErrorsColumn,
  ReplayDurationColumn,
  ReplayOSColumn,
  ReplaySessionColumn,
} from 'sentry/components/replays/table/replayTableColumns';
import {useReplayPlaylist} from 'sentry/utils/replays/playback/providers/replayPlaylistProvider';
import {useLocation} from 'sentry/utils/useLocation';
import useAllMobileProj from 'sentry/views/replays/detail/useAllMobileProj';

const VISIBLE_COLUMNS = [
  ReplaySessionColumn,
  ReplayOSColumn,
  ReplayBrowserColumn,
  ReplayDurationColumn,
  ReplayCountErrorsColumn,
];

const MOBILE_COLUMNS = [
  ReplaySessionColumn,
  ReplayOSColumn,
  ReplayDurationColumn,
  ReplayCountErrorsColumn,
];

export default function Playlist() {
  const {replays, currentReplayIndex, isLoading} = useReplayPlaylist();
  const location = useLocation();

  const {allMobileProj} = useAllMobileProj({});
  const columns = allMobileProj ? MOBILE_COLUMNS : VISIBLE_COLUMNS;
  return (
    <ReplayTable
      columns={columns}
      error={null}
      highlightedRowIndex={currentReplayIndex}
      // we prefer isLoading since it is only true if there is a fetch request in flight
      // React Query's isPending is true as long as there is no data
      // https://github.com/TanStack/query/discussions/7329
      isPending={isLoading}
      query={location.query}
      replays={replays}
      showDropdownFilters={false}
    />
  );
}
