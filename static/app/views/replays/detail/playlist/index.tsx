import {useEffect, useState} from 'react';

import {Flex, Grid} from '@sentry/scraps/layout';

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
import ReplaysSearch from 'sentry/views/replays/list/search';

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
  const {replays, currentReplayIndex, isLoading, pageLinks} = useReplayPlaylist();
  const location = useLocation();
  const [q, setQuery] = useState();

  useEffect(() => {
    if (location.query == 'foo') {
      // testing sentry
      setQuery(location.query);
    }
  }, []);

  const {allMobileProj} = useAllMobileProj({});
  const columns = allMobileProj ? MOBILE_COLUMNS : VISIBLE_COLUMNS;

  return (
    <Flex height="0" minHeight="100%">
      <Grid gap="md" rows="max-content auto" height="100%" width="100%">
        <ReplaysSearch />
        <ReplayTable
          columns={columns}
          error={null}
          highlightedRowIndex={currentReplayIndex}
          // we prefer isLoading since isPending is true even if not enabled
          isPending={isLoading}
          query={location.query}
          replays={replays}
          showDropdownFilters={false}
          pageLinks={pageLinks}
          stickyHeader
        />
      </Grid>
    </Flex>
  );
}
