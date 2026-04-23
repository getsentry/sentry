import {Fragment} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Pagination} from 'sentry/components/pagination';
import {useReplayTableSort} from 'sentry/components/replays/table/useReplayTableSort';
import {trackAnalytics} from 'sentry/utils/analytics';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import {replayListApiOptions} from 'sentry/utils/replays/replayListApiOptions';
import {useLocationQuery} from 'sentry/utils/url/useLocationQuery';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ReplayIndexTable} from 'sentry/views/explore/replays/list/replayIndexTable';

interface Props {
  onToggleWidgets: () => void;
  showDeadRageClickCards: boolean;
  widgetIsOpen: boolean;
}

export function ReplayIndexContainer({
  onToggleWidgets,
  showDeadRageClickCards,
  widgetIsOpen,
}: Props) {
  const organization = useOrganization();
  const navigate = useNavigate();

  const {sortQuery} = useReplayTableSort();
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
  const replayListOptions = replayListApiOptions({
    options: {query: {...query, sort: sortQuery}},
    organization,
    queryReferrer: 'replayList',
  });
  const {
    data: response,
    isPending,
    error,
  } = useQuery({
    ...replayListOptions,
    select: selectJsonWithHeaders,
  });
  const replays = response?.json?.data?.map(mapResponseToReplayRecord) ?? [];

  const pageLinks = response?.headers.Link ?? null;
  const hasNextResultsPage = parseLinkHeader(pageLinks).next?.results;
  const hasPrevResultsPage = parseLinkHeader(pageLinks).prev?.results;

  return (
    <Fragment>
      <ReplayIndexTable
        replays={replays}
        isPending={isPending}
        error={error}
        hasMoreResults={Boolean(hasNextResultsPage || hasPrevResultsPage)}
        onToggleWidgets={onToggleWidgets}
        queryKey={replayListOptions.queryKey}
        showDeadRageClickCards={showDeadRageClickCards}
        widgetIsOpen={widgetIsOpen}
      />
      <PaginationNoMargin
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
    </Fragment>
  );
}

const PaginationNoMargin = styled(Pagination)`
  margin-top: 0;
`;
