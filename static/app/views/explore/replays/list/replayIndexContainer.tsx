import {Fragment} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import {parseAsString, useQueryStates} from 'nuqs';

import {Pagination} from '@sentry/scraps/pagination';

import {useReplayTableSort} from 'sentry/components/replays/table/useReplayTableSort';
import {trackAnalytics} from 'sentry/utils/analytics';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getPaginationProps} from 'sentry/utils/pagination';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import {replayListApiOptions} from 'sentry/utils/replays/replayListApiOptions';
import {pageFilterParsers} from 'sentry/utils/url/pageFilterParsers';
import {useOrganization} from 'sentry/utils/useOrganization';

import {ReplayIndexTable} from './replayIndexTable';

const replayListParsers = {
  ...pageFilterParsers,
  cursor: parseAsString.withDefault(''),
  query: parseAsString.withDefault(''),
};

interface Props {
  showDeadRageClickCards: boolean;
  showDeadRageClickCardsPlaceholder: boolean;
  widgetIsOpen: boolean;
}

export function ReplayIndexContainer({
  showDeadRageClickCards,
  showDeadRageClickCardsPlaceholder,
  widgetIsOpen,
}: Props) {
  const organization = useOrganization();

  const {sortQuery} = useReplayTableSort();
  const [query] = useQueryStates(replayListParsers);
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
        queryKey={replayListOptions.queryKey}
        showDeadRageClickCards={showDeadRageClickCards}
        showDeadRageClickCardsPlaceholder={showDeadRageClickCardsPlaceholder}
        widgetIsOpen={widgetIsOpen}
      />
      <PaginationNoMargin
        {...getPaginationProps(pageLinks)}
        onPageChange={(_cursor, delta) => {
          trackAnalytics('replay.list-paginated', {
            organization,
            direction: delta === -1 ? 'prev' : 'next',
          });
        }}
      />
    </Fragment>
  );
}

const PaginationNoMargin = styled(Pagination)`
  margin-top: 0;
`;
