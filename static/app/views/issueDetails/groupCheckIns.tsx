import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import Duration from 'sentry/components/duration';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnOrder,
} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {User} from 'sentry/types/user';
import {getShortEventId} from 'sentry/utils/events';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useUser} from 'sentry/utils/useUser';
import {
  type UptimeCheckIn,
  useUptimeCheckIns,
} from 'sentry/views/issueDetails/queries/useUptimeCheckIns';
import {EventListTable} from 'sentry/views/issueDetails/streamline/eventListTable';
import {useGroup} from 'sentry/views/issueDetails/useGroup';
import {useGroupEvent} from 'sentry/views/issueDetails/useGroupEvent';

function GroupCheckIns() {
  const organization = useOrganization();
  const {groupId} = useParams<{groupId: string}>();
  const location = useLocation();
  const user = useUser();

  const {
    data: group,
    isPending: isGroupPending,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup({groupId});

  const {
    data: event,
    isPending: isEventPending,
    isError: isEventError,
    refetch: refetchEvent,
  } = useGroupEvent({
    groupId,
    eventId: user.options.defaultIssueEvent,
  });

  const uptimeAlertId = event?.tags?.find(tag => tag.key === 'uptime_rule')?.value;
  const isUptimeAlert =
    Boolean(organization.slug) && Boolean(group?.project.slug) && Boolean(uptimeAlertId);

  const {data: uptimeData, getResponseHeader} = useUptimeCheckIns(
    {
      orgSlug: organization.slug,
      projectSlug: group?.project.slug ?? '',
      uptimeAlertId: uptimeAlertId ?? '',
      cursor: decodeScalar(location.query.cursor),
      limit: 50,
    },
    {enabled: isUptimeAlert}
  );

  if (isGroupError) {
    return <LoadingError onRetry={refetchGroup} />;
  }

  if (isEventError) {
    return <LoadingError onRetry={refetchEvent} />;
  }

  if (isEventPending || isGroupPending || !uptimeData) {
    return <LoadingIndicator />;
  }

  const links = parseLinkHeader(getResponseHeader?.('Link') ?? '');
  const previousDisabled = isEventPending || links?.previous?.results === false;
  const nextDisabled = isEventPending || links?.next?.results === false;
  const pageCount = uptimeData.length;

  return (
    <EventListTable
      title={t('All Check-ins')}
      pagination={{
        tableUnits: t('check-ins'),
        links,
        pageCount,
        nextDisabled,
        previousDisabled,
      }}
    >
      <GridEditable
        isLoading={isEventPending}
        data={uptimeData}
        columnOrder={[
          {key: 'timestamp', width: COL_WIDTH_UNDEFINED, name: t('Timestamp')},
          {key: 'checkStatus', width: 115, name: t('Status')},
          {key: 'durationMs', width: 110, name: t('Duration')},
          {key: 'environment', width: 115, name: t('Environment')},
          {key: 'traceId', width: 100, name: t('Trace')},
          {key: 'region', width: 100, name: t('Region')},
          {key: 'uptimeCheckId', width: 100, name: t('ID')},
        ]}
        columnSortBy={[]}
        grid={{
          renderHeadCell: (col: GridColumnOrder) => <Cell>{col.name}</Cell>,
          renderBodyCell: (column, dataRow) => (
            <CheckInBodyCell
              column={column}
              dataRow={dataRow}
              userOptions={user.options}
            />
          ),
        }}
      />
    </EventListTable>
  );
}

function CheckInBodyCell({
  dataRow,
  column,
  userOptions,
}: {
  column: GridColumnOrder<string>;
  dataRow: UptimeCheckIn;
  userOptions: User['options'];
}) {
  const theme = useTheme();
  const columnKey = column.key as keyof UptimeCheckIn;
  const cellData = dataRow[columnKey];

  if (!cellData) {
    return <Cell />;
  }

  switch (columnKey) {
    case 'timestamp': {
      const format = userOptions.clock24Hours
        ? 'MMM D, YYYY HH:mm:ss z'
        : 'MMM D, YYYY h:mm:ss A z';
      return (
        <Cell>
          <TimeSince
            tooltipShowSeconds
            unitStyle="short"
            date={cellData}
            tooltipProps={{maxWidth: 300}}
            tooltipBody={
              <LabelledTooltip>
                <dt>{t('Scheduled for')}</dt>
                <dd>
                  {moment
                    .tz(dataRow.scheduledCheckTime, userOptions?.timezone ?? '')
                    .format(format)}
                </dd>
                <dt>{t('Checked at')}</dt>
                <dd>{moment.tz(cellData, userOptions?.timezone ?? '').format(format)}</dd>
              </LabelledTooltip>
            }
          />
        </Cell>
      );
    }
    case 'durationMs':
      if (typeof cellData === 'number') {
        return (
          <Cell>
            <Duration seconds={cellData / 1000} abbreviation exact />
          </Cell>
        );
      }
      return <Cell>{cellData}</Cell>;
    case 'statusCode': {
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
    }
    case 'checkStatus': {
      let checkResult = <Cell>{cellData}</Cell>;
      switch (cellData) {
        case 'success':
          checkResult = <Cell style={{color: theme.successText}}>{t('Success')}</Cell>;
          break;
        case 'missed_window':
          checkResult = (
            <Cell style={{color: theme.warningText}}>{t('Missed Window')}</Cell>
          );
          break;
        case 'failure':
          checkResult = <Cell style={{color: theme.errorText}}>{t('Failure')}</Cell>;
          break;
        default:
          checkResult = <Cell>{cellData}</Cell>;
          break;
      }
      return dataRow.checkStatusReason ? (
        <Tooltip
          title={
            <LabelledTooltip>
              <dt>{t('Reason')}</dt>
              <dd>{dataRow.checkStatusReason}</dd>
            </LabelledTooltip>
          }
        >
          {checkResult}
        </Tooltip>
      ) : (
        checkResult
      );
    }
    case 'traceId':
      return (
        <LinkCell to={`/performance/trace/${cellData}`}>
          {getShortEventId(String(cellData))}
        </LinkCell>
      );
    default:
      return <Cell>{dataRow[columnKey]}</Cell>;
  }
}

const Cell = styled('div')`
  display: flex;
  align-items: center;
  text-align: left;
  gap: ${space(1)};
`;

const LinkCell = styled(Link)`
  text-decoration: underline;
  text-decoration-color: ${p => p.theme.subText};
  cursor: pointer;
  text-decoration-style: dotted;
`;

const LabelledTooltip = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(0.5)} ${space(1)};
  text-align: left;
  margin: 0;
`;

export default GroupCheckIns;
