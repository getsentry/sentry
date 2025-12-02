import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import Placeholder from 'sentry/components/placeholder';
import ReplayLoadingState from 'sentry/components/replays/player/replayLoadingState';
import {useLiveRefresh} from 'sentry/components/replays/replayLiveIndicator';
import {ReplaySessionColumn} from 'sentry/components/replays/table/replayTableColumns';
import {IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import type useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

interface Props {
  readerResult: ReturnType<typeof useLoadReplayReader>;
}
export default function ReplayDetailsUserBadge({readerResult}: Props) {
  const organization = useOrganization();
  const replayRecord = readerResult.replayRecord;
  const replayId = replayRecord?.id;
  const {shouldShowRefreshButton, doRefresh} = useLiveRefresh({replay: replayRecord});

  // Generate search query based on available user data
  const getUserSearchQuery = () => {
    if (!replayRecord?.user) {
      return null;
    }

    const user = replayRecord.user;
    // Prefer email over id for search query
    if (user.email) {
      return `user.email:"${user.email}"`;
    }
    if (user.id) {
      return `user.id:"${user.id}"`;
    }
    return null;
  };
  const searchQuery = getUserSearchQuery();

  const location = useLocation();
  const linkQuery = searchQuery
    ? {
        pathname: makeReplaysPathname({
          path: '/',
          organization,
        }),
        query: {
          query: searchQuery,
        },
      }
    : {
        pathname: makeReplaysPathname({
          path: `/${replayId}/`,
          organization,
        }),
        query: {
          ...location.query,
        },
      };

  const badge = replayRecord ? (
    <ColumnWrapper gap="md">
      <StyledReplaySessionColumn
        replay={replayRecord}
        rowIndex={0}
        columnIndex={0}
        showDropdownFilters={false}
        to={linkQuery}
      />
      <Button
        title={t('Replay is outdated. Refresh for latest activity.')}
        data-test-id="refresh-button"
        size="xs"
        onClick={doRefresh}
        style={{visibility: shouldShowRefreshButton ? 'visible' : 'hidden'}}
      >
        <IconRefresh />
      </Button>
    </ColumnWrapper>
  ) : null;

  return (
    <ReplayLoadingState
      readerResult={readerResult}
      renderArchived={() => null}
      renderError={() => null}
      renderThrottled={() => null}
      renderLoading={() =>
        replayRecord ? badge : <Placeholder width="251px" height="42px" />
      }
      renderMissing={() => null}
      renderProcessingError={() => badge}
    >
      {() => badge}
    </ReplayLoadingState>
  );
}

// column components expect to be stored in a relative container
const ColumnWrapper = styled(Flex)`
  position: relative;
`;

const StyledReplaySessionColumn = styled(ReplaySessionColumn.Component)`
  flex: 0;
`;
