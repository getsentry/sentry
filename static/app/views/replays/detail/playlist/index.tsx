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

const VISIBLE_COLUMNS = [
  ReplaySessionColumn,
  ReplayOSColumn,
  ReplayBrowserColumn,
  ReplayDurationColumn,
  ReplayCountErrorsColumn,
];

export default function Playlist() {
  const replays = useReplayPlaylist();
  const tableRef = useRef<HTMLDivElement>(null);

  return (
    <ReplayTable
      ref={tableRef}
      columns={VISIBLE_COLUMNS}
      error={null}
      isPending={replays ? false : true}
      replays={replays ?? []}
      showDropdownFilters={false}
    />
  );
}
