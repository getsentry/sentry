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
  const {replays, currentReplayIndex} = useReplayPlaylist();
  const location = useLocation();

  const {allMobileProj} = useAllMobileProj({});
  const columns = allMobileProj ? MOBILE_COLUMNS : VISIBLE_COLUMNS;
  return (
    <ReplayTable
      columns={columns}
      error={null}
      highlightedRowIndex={currentReplayIndex}
      isPending={false}
      query={location.query}
      replays={replays}
      showDropdownFilters={false}
    />
  );
}
