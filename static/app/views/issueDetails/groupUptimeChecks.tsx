import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {usePageFilterDates} from 'sentry/components/checkInTimeline/hooks/useMonitorDates';
import Duration from 'sentry/components/duration';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnOrder,
} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {User} from 'sentry/types/user';
import {FIELD_FORMATTERS} from 'sentry/utils/discover/fieldRenderers';
import {getShortEventId} from 'sentry/utils/events';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useUser} from 'sentry/utils/useUser';
import {CheckStatus, type UptimeCheck} from 'sentry/views/alerts/rules/uptime/types';
import {statusToText, tickStyle} from 'sentry/views/insights/uptime/timelineConfig';
import {useUptimeChecks} from 'sentry/views/insights/uptime/utils/useUptimeChecks';
import {EventListTable} from 'sentry/views/issueDetails/streamline/eventListTable';
import {useUptimeIssueAlertId} from 'sentry/views/issueDetails/streamline/issueUptimeCheckTimeline';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

/**
 * This value is used when a trace was not recorded since the field is required.
 * It will never link to trace, so omit the row to avoid confusion.
 */
const EMPTY_TRACE = '00000000000000000000000000000000';

export default function GroupUptimeChecks() {
  const organization = useOrganization();
  const {groupId} = useParams<{groupId: string}>();
  const location = useLocation();
  const user = useUser();
  const {since, until} = usePageFilterDates();
  const uptimeAlertId = useUptimeIssueAlertId({groupId});

  const {
    data: group,
    isPending: isGroupPending,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup({groupId});

  const canFetchUptimeChecks =
    Boolean(organization.slug) && Boolean(group?.project.slug) && Boolean(uptimeAlertId);

  const {data: uptimeData, getResponseHeader} = useUptimeChecks(
    {
      orgSlug: organization.slug,
      projectSlug: group?.project.slug ?? '',
      uptimeAlertId: uptimeAlertId ?? '',
      cursor: decodeScalar(location.query.cursor),
      limit: 50,
      start: since.toISOString(),
      end: until.toISOString(),
    },
    {enabled: canFetchUptimeChecks}
  );

  if (isGroupError) {
    return <LoadingError onRetry={refetchGroup} />;
  }

  if (isGroupPending || !uptimeData) {
    return <LoadingIndicator />;
  }

  const links = parseLinkHeader(getResponseHeader?.('Link') ?? '');
  const previousDisabled = links?.previous?.results === false;
  const nextDisabled = links?.next?.results === false;
  const pageCount = uptimeData.length;

  return (
    <EventListTable
      title={t('All Uptime Checks')}
      pagination={{
        tableUnits: t('uptime checks'),
        links,
        pageCount,
        nextDisabled,
        previousDisabled,
      }}
    >
      <GridEditable
        isLoading={isGroupPending}
        emptyMessage={t('No matching uptime checks found')}
        data={uptimeData}
        columnOrder={[
          {key: 'timestamp', width: COL_WIDTH_UNDEFINED, name: t('Timestamp')},
          {key: 'checkStatus', width: 115, name: t('Status')},
          {key: 'durationMs', width: 110, name: t('Duration')},
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
  dataRow: UptimeCheck;
  userOptions: User['options'];
}) {
  const theme = useTheme();
  const columnKey = column.key as keyof UptimeCheck;
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
        <TimeCell>
          <Tooltip
            maxWidth={300}
            isHoverable
            title={
              <LabelledTooltip>
                {dataRow.scheduledCheckTime && (
                  <Fragment>
                    <dt>{t('Scheduled for')}</dt>
                    <dd>
                      {moment
                        .tz(dataRow.scheduledCheckTime, userOptions?.timezone ?? '')
                        .format(format)}
                    </dd>
                  </Fragment>
                )}
                <dt>{t('Checked at')}</dt>
                <dd>{moment.tz(cellData, userOptions?.timezone ?? '').format(format)}</dd>
              </LabelledTooltip>
            }
          >
            {FIELD_FORMATTERS.date.renderFunc('timestamp', dataRow)}
          </Tooltip>
        </TimeCell>
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
      const status = cellData as CheckStatus;
      if (Object.values(CheckStatus).includes(status)) {
        const colorKey = tickStyle[status].labelColor ?? 'textColor';
        checkResult = (
          <Cell style={{color: theme[colorKey] as string}}>{statusToText[status]}</Cell>
        );
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
      if (cellData === EMPTY_TRACE) {
        return <Cell />;
      }
      return (
        <LinkCell to={`/performance/trace/${cellData}/`}>
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

const TimeCell = styled(Cell)`
  color: ${p => p.theme.subText};
  text-decoration: underline;
  text-decoration-style: dotted;
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
