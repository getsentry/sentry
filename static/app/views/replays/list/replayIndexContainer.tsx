import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Pagination} from 'sentry/components/pagination';
import {useReplayTableSort} from 'sentry/components/replays/table/useReplayTableSort';
import {trackAnalytics} from 'sentry/utils/analytics';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {useReplayListQueryKey} from 'sentry/utils/replays/hooks/useReplayListQueryKey';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import {useLocationQuery} from 'sentry/utils/url/useLocationQuery';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ReplayIndexTable} from 'sentry/views/replays/list/replayIndexTable';
import type {ReplayListRecord} from 'sentry/views/replays/types';

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
  const queryKey = useReplayListQueryKey({
    options: {query: {...query, sort: sortQuery}},
    organization,
    queryReferrer: 'replayList',
  });
  const {data, isPending, error, getResponseHeader} = useApiQuery<{
    data: ReplayListRecord[];
    enabled: true;
  }>(queryKey, {staleTime: 0});
  const replays = data?.data?.map(mapResponseToReplayRecord) ?? [];

  const pageLinks = getResponseHeader?.('Link') ?? null;
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
        queryKey={queryKey}
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
