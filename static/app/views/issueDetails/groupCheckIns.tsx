import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import Duration from 'sentry/components/duration';
import GridEditable, {type GridColumnOrder} from 'sentry/components/gridEditable';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {User} from 'sentry/types/user';
import {defined} from 'sentry/utils';
import {FIELD_FORMATTERS} from 'sentry/utils/discover/fieldRenderers';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useUser} from 'sentry/utils/useUser';
import {EventListTable} from 'sentry/views/issueDetails/streamline/eventListTable';
import {useCronIssueAlertId} from 'sentry/views/issueDetails/streamline/issueCronCheckTimeline';
import {useGroup} from 'sentry/views/issueDetails/useGroup';
import {type CheckIn, CheckInStatus} from 'sentry/views/monitors/types';
import {statusToText, tickStyle} from 'sentry/views/monitors/utils';
import {scheduleAsText} from 'sentry/views/monitors/utils/scheduleAsText';
import {useMonitorCheckIns} from 'sentry/views/monitors/utils/useMonitorCheckIns';

export default function GroupCheckIns() {
  const organization = useOrganization();
  const {groupId} = useParams<{groupId: string}>();
  const location = useLocation();
  const user = useUser();
  const cronAlertId = useCronIssueAlertId({groupId});

  const {
    data: group,
    isPending: isGroupPending,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup({groupId});

  const canFetchMonitorCheckIns =
    Boolean(organization.slug) && Boolean(group?.project.slug) && Boolean(cronAlertId);

  const {cursor, ...locationQuery} = location.query;
  const {
    data: cronData = [],
    isPending: isDataPending,
    getResponseHeader,
  } = useMonitorCheckIns(
    {
      orgSlug: organization.slug,
      projectSlug: group?.project.slug ?? '',
      monitorIdOrSlug: cronAlertId ?? '',
      limit: 50,
      cursor: decodeScalar(cursor),
      queryParams: locationQuery,
    },
    {enabled: canFetchMonitorCheckIns}
  );

  if (isGroupError) {
    return <LoadingError onRetry={refetchGroup} />;
  }

  if (isGroupPending) {
    return <LoadingIndicator />;
  }

  const links = parseLinkHeader(getResponseHeader?.('Link') ?? '');
  const previousDisabled = links?.previous?.results === false;
  const nextDisabled = links?.next?.results === false;
  const pageCount = cronData.length;

  return (
    <EventListTable
      title={t('All Check-Ins')}
      pagination={{
        tableUnits: t('check-ins'),
        links,
        pageCount,
        nextDisabled,
        previousDisabled,
      }}
    >
      <GridEditable
        isLoading={isDataPending}
        emptyMessage={t('No matching check-ins found')}
        data={cronData}
        columnOrder={[
          {key: 'dateCreated', width: 225, name: t('Timestamp')},
          {key: 'status', width: 100, name: t('Status')},
          {key: 'duration', width: 130, name: t('Duration')},
          {key: 'environment', width: 120, name: t('Environment')},
          {key: 'monitorConfig', width: 145, name: t('Monitor Config')},
          {key: 'id', width: 100, name: t('ID')},
        ]}
        columnSortBy={[]}
        grid={{
          renderHeadCell: (column: GridColumnOrder) => <CheckInHeader column={column} />,
          renderBodyCell: (column, dataRow) => (
            <CheckInCell column={column} dataRow={dataRow} userOptions={user.options} />
          ),
        }}
      />
    </EventListTable>
  );
}

function CheckInHeader({column}: {column: GridColumnOrder}) {
  if (column.key === 'monitorConfig') {
    return (
      <Cell>
        {t('Monitor Config')}
        <Tooltip
          title={t(
            'These are snapshots of the monitor configuration at the time of the check-in. They may differ from the current monitor config.'
          )}
          style={{lineHeight: 0}}
        >
          <IconInfo size="xs" />
        </Tooltip>
      </Cell>
    );
  }
  return <Cell>{column.name}</Cell>;
}

function CheckInCell({
  dataRow,
  column,
  userOptions,
}: {
  column: GridColumnOrder<string>;
  dataRow: CheckIn;
  userOptions: User['options'];
}) {
  const theme = useTheme();
  const columnKey = column.key as keyof CheckIn;

  if (!dataRow[columnKey]) {
    return <Cell />;
  }

  switch (columnKey) {
    case 'dateCreated': {
      const format = userOptions.clock24Hours
        ? 'MMM D, YYYY HH:mm:ss z'
        : 'MMM D, YYYY h:mm:ss A z';
      return (
        <HoverableCell>
          <Tooltip
            maxWidth={300}
            isHoverable
            title={
              <LabelledTooltip>
                {dataRow.expectedTime && (
                  <Fragment>
                    <dt>{t('Expected at')}</dt>
                    <dd>
                      {moment
                        .tz(dataRow.expectedTime, userOptions?.timezone ?? '')
                        .format(format)}
                    </dd>
                  </Fragment>
                )}
                <dt>{t('Received at')}</dt>
                <dd>
                  {moment
                    .tz(dataRow[columnKey], userOptions?.timezone ?? '')
                    .format(format)}
                </dd>
              </LabelledTooltip>
            }
          >
            {FIELD_FORMATTERS.date.renderFunc('dateCreated', dataRow)}
          </Tooltip>
        </HoverableCell>
      );
    }
    case 'duration': {
      const cellData = dataRow[columnKey];
      if (typeof cellData === 'number') {
        return (
          <Cell>
            <Duration seconds={cellData / 1000} abbreviation exact />
          </Cell>
        );
      }
      return <Cell>{cellData}</Cell>;
    }
    case 'status': {
      const status = dataRow[columnKey];
      let checkResult = <Cell>{status}</Cell>;
      if (Object.values(CheckInStatus).includes(status)) {
        const colorKey = tickStyle[status].labelColor ?? 'textColor';
        checkResult = (
          <Cell style={{color: theme[colorKey] as string}}>{statusToText[status]}</Cell>
        );
      }
      return checkResult;
    }
    case 'monitorConfig': {
      const config = dataRow[columnKey];

      return (
        <HoverableCell>
          <Tooltip
            maxWidth={400}
            isHoverable
            title={
              <LabelledTooltip>
                <dt>{t('Schedule')}</dt>
                <dd>{scheduleAsText(config)}</dd>
                {defined(config.schedule_type) && (
                  <Fragment>
                    <dt>{t('Schedule Type')}</dt>
                    <dd>{config.schedule_type}</dd>
                  </Fragment>
                )}

                {defined(config.checkin_margin) && (
                  <Fragment>
                    <dt>{t('Check-in Margin')}</dt>
                    <dd>{config.checkin_margin}</dd>
                  </Fragment>
                )}
                {defined(config.max_runtime) && (
                  <Fragment>
                    <dt>{t('Max Runtime')}</dt>
                    <dd>{config.max_runtime}</dd>
                  </Fragment>
                )}
                {defined(config.timezone) && (
                  <Fragment>
                    <dt>{t('Timezone')}</dt>
                    <dd>{config.timezone}</dd>
                  </Fragment>
                )}
                {defined(config.failure_issue_threshold) && (
                  <Fragment>
                    <dt>{t('Failure Threshold')}</dt>
                    <dd>{config.failure_issue_threshold}</dd>
                  </Fragment>
                )}
                {defined(config.recovery_threshold) && (
                  <Fragment>
                    <dt>{t('Recovery Threshold')}</dt>
                    <dd>{config.recovery_threshold}</dd>
                  </Fragment>
                )}
              </LabelledTooltip>
            }
          >
            {t('View Config')}
          </Tooltip>
        </HoverableCell>
      );
    }
    // We don't query groups for this table yet
    case 'groups':
      return <Cell />;
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

const HoverableCell = styled(Cell)`
  color: ${p => p.theme.subText};
  text-decoration: underline;
  text-decoration-style: dotted;
`;

const LabelledTooltip = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(0.5)} ${space(1)};
  text-align: left;
  margin: 0;
`;
