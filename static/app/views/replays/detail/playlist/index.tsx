import {useRef} from 'react';

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

const VISIBLE_COLUMNS = [
  ReplaySessionColumn,
  ReplayOSColumn,
  ReplayBrowserColumn,
  ReplayDurationColumn,
  ReplayCountErrorsColumn,
];

export default function Playlist() {
  const {replays, currentReplayIndex} = useReplayPlaylist();
  const tableRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  return (
    <ReplayTable
      ref={tableRef}
      columns={VISIBLE_COLUMNS}
      error={null}
      highlightedRowIndex={currentReplayIndex}
      isPending={replays ? false : true}
      query={location.query}
      replays={replays ?? []}
      showDropdownFilters={false}
    />
  );
}
