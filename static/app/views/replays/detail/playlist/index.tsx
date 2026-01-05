import {parseAsString, useQueryState} from 'nuqs';

import {Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Alert} from 'sentry/components/core/alert';
import Pagination from 'sentry/components/pagination';
import ReplayTable from 'sentry/components/replays/table/replayTable';
import {
  ReplayBrowserColumn,
  ReplayCountErrorsColumn,
  ReplayDurationColumn,
  ReplayOSColumn,
  ReplaySessionColumn,
} from 'sentry/components/replays/table/replayTableColumns';
import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {t} from 'sentry/locale';
import {useReplayPlaylist} from 'sentry/utils/replays/playback/providers/replayPlaylistProvider';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
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
  const {replays, currentReplayIndex, isLoading, pageLinks} = useReplayPlaylist();
  const location = useLocation();
  const navigate = useNavigate();
  const [query] = useQueryState('query', parseAsString.withDefault(''));

  const {allMobileProj} = useAllMobileProj({});
  const columns = allMobileProj ? MOBILE_COLUMNS : VISIBLE_COLUMNS;
  const rows = query ? 'max-content auto' : 'auto';

  return (
    <Flex height="100%" overflow="auto">
      <Grid gap="md" rows={rows} height="100%" width="100%">
        {query ? (
          <Alert
            variant="info"
            showIcon
            defaultExpanded
            expand={<ProvidedFormattedQuery query={query} />}
          >
            <Text>{t('This playlist is filtered by:')} </Text>
          </Alert>
        ) : null}
        <Flex direction="column" gap="md" height="100%">
          <Flex height="100%" overflow="auto">
            <ReplayTable
              columns={columns}
              error={null}
              highlightedRowIndex={currentReplayIndex}
              // we prefer isLoading since isPending is true even if not enabled
              isPending={isLoading}
              query={location.query}
              replays={replays}
              showDropdownFilters={false}
              stickyHeader
            />
          </Flex>
          <Pagination
            pageLinks={pageLinks}
            onCursor={(cursor, path, searchQuery) => {
              navigate({
                pathname: path,
                query: {...searchQuery, cursor},
              });
            }}
          />
        </Flex>
      </Grid>
    </Flex>
  );
}
