import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Duration from 'sentry/components/duration';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnOrder,
} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TimeSince from 'sentry/components/timeSince';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t, tct} from 'sentry/locale';
import {parseCursor} from 'sentry/utils/cursor';
import {getShortEventId} from 'sentry/utils/events';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import {useUser} from 'sentry/utils/useUser';
import {
  EventListHeader,
  EventListHeaderItem,
  EventListTitle,
  StreamlineEventsTable,
} from 'sentry/views/issueDetails/streamline/eventList';
import {useGroupEvent} from 'sentry/views/issueDetails/useGroupEvent';

interface CheckInDisplayData {
  duration: number;
  env: string;
  method: string;
  statusCode: string;
  time: string;
  trace: string;
}

function GroupCheckIns() {
  const {groupId} = useParams<{groupId: string}>();
  const location = useLocation();
  const user = useUser();

  const {
    isPending: isEventPending,
    isError: isEventError,
    refetch: refetchEvent,
  } = useGroupEvent({
    groupId,
    eventId: user.options.defaultIssueEvent,
  });

  if (isEventError) {
    return <LoadingError onRetry={refetchEvent} />;
  }

  if (isEventPending) {
    return <LoadingIndicator />;
  }

  // TODO(leander): Fetch this data from the backend
  const data: CheckInDisplayData[] = [];

  // TODO(leander): Parse the page links from the backend response
  const links = parseLinkHeader('');
  const previousDisabled = links.previous?.results === false;
  const nextDisabled = links.next?.results === false;
  const currentCursor = parseCursor(location.query?.cursor);
  const start = Math.max(currentCursor?.offset ?? 1, 1);
  const pageCount = data.length;
  // TODO(leander): Update this to use the actual total count
  const totalCount = 500;

  return (
    <StreamlineEventsTable>
      <EventListHeader>
        <EventListTitle>{t('All Check-ins')}</EventListTitle>
        <EventListHeaderItem>
          {pageCount === 0
            ? null
            : tct('Showing [start]-[end] of [count] matching check-ins', {
                start: start.toLocaleString(),
                end: ((currentCursor?.offset ?? 0) + pageCount).toLocaleString(),
                count: (totalCount ?? 0).toLocaleString(),
              })}
        </EventListHeaderItem>
        <EventListHeaderItem>
          <ButtonBar gap={0.25}>
            <GrayLinkButton
              aria-label={t('Previous Page')}
              borderless
              size="xs"
              icon={<IconChevron direction="left" />}
              to={{
                ...location,
                query: {
                  ...location.query,
                  cursor: links.previous?.cursor,
                },
              }}
              disabled={isEventPending || previousDisabled}
            />
            <GrayLinkButton
              aria-label={t('Next Page')}
              borderless
              size="xs"
              icon={<IconChevron direction="right" />}
              to={{
                ...location,
                query: {
                  ...location.query,
                  cursor: links.next?.cursor,
                },
              }}
              disabled={isEventPending || nextDisabled}
            />
          </ButtonBar>
        </EventListHeaderItem>
      </EventListHeader>
      <GridEditable
        isLoading={isEventPending}
        data={data}
        columnOrder={[
          {key: 'time', width: COL_WIDTH_UNDEFINED, name: t('Time')},
          {key: 'statusCode', width: 115, name: t('Status Code')},
          {key: 'method', width: 100, name: t('Method')},
          {key: 'duration', width: 110, name: t('Duration')},
          {key: 'env', width: COL_WIDTH_UNDEFINED, name: t('Environment')},
          {key: 'trace', width: 100, name: t('Trace')},
        ]}
        columnSortBy={[]}
        grid={{
          renderHeadCell: (col: GridColumnOrder) => <Cell>{col.name}</Cell>,
          renderBodyCell: (column, dataRow) => (
            <CheckInBodyCell column={column} dataRow={dataRow} />
          ),
        }}
      />
    </StreamlineEventsTable>
  );
}

function CheckInBodyCell({
  dataRow,
  column,
}: {
  column: GridColumnOrder<string>;
  dataRow: CheckInDisplayData;
}) {
  const theme = useTheme();
  const columnKey = column.key as keyof CheckInDisplayData;
  const cellData = dataRow[columnKey];

  if (!cellData) {
    return <Cell />;
  }

  switch (columnKey) {
    case 'time':
      return (
        <Cell>
          <TimeSince date={new Date(cellData)} />
        </Cell>
      );
    case 'duration':
      if (typeof cellData === 'number') {
        return (
          <Cell>
            <Duration seconds={cellData / 100000} abbreviation />
          </Cell>
        );
      }
      return <Cell>{cellData}</Cell>;
    case 'statusCode':
      const statusCodeFirstDigit = String(cellData)?.[0];
      switch (statusCodeFirstDigit) {
        case '2':
          return <Cell style={{color: theme.successText}}>{cellData}</Cell>;
        case '3':
          return <Cell style={{color: theme.warningText}}>{cellData}</Cell>;
        case '4':
        case '5':
          return <Cell style={{color: theme.errorText}}>{cellData}</Cell>;
        default:
          return <Cell>{cellData}</Cell>;
      }
    case 'trace':
      return (
        <LinkCell to={`/performance/trace/${cellData}`}>
          {getShortEventId(String(cellData))}
        </LinkCell>
      );
    default:
      return <Cell>{dataRow[columnKey]}</Cell>;
  }
}

const Cell = styled('span')`
  text-align: left;
  width: 100%;
`;

const LinkCell = styled(Link)`
  text-decoration: underline;
  text-decoration-color: ${p => p.theme.subText};
  cursor: pointer;
  text-decoration-style: dotted;
`;

const GrayLinkButton = styled(LinkButton)`
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightNormal};
`;

export default GroupCheckIns;
