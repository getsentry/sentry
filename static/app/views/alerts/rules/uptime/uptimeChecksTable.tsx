import {Fragment} from 'react';
import styled from '@emotion/styled';

import {SectionHeading} from 'sentry/components/charts/styles';
import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels/panelTable';
import Placeholder from 'sentry/components/placeholder';
import {
  StatusIndicator,
  type StatusIndicatorProps,
} from 'sentry/components/statusIndicator';
import Text from 'sentry/components/text';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getShortEventId} from 'sentry/utils/events';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {CheckStatus, type UptimeRule} from 'sentry/views/alerts/rules/uptime/types';
import {statusToText} from 'sentry/views/insights/uptime/timelineConfig';
import {useUptimeChecks} from 'sentry/views/insights/uptime/utils/useUptimeChecks';

type Props = {
  uptimeRule: UptimeRule;
};

export const checkStatusToIndicatorStatus: Record<
  CheckStatus,
  StatusIndicatorProps['status']
> = {
  [CheckStatus.SUCCESS]: 'success',
  [CheckStatus.FAILURE]: 'warning',
  [CheckStatus.FAILURE_INCIDENT]: 'error',
  [CheckStatus.MISSED_WINDOW]: 'muted',
};

export function UptimeChecksTable({uptimeRule}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  const timeRange = {
    start: decodeScalar(location.query.start),
    end: decodeScalar(location.query.end),
    statsPeriod: decodeScalar(location.query.statsPeriod),
  };

  const {
    data: uptimeChecks,
    isError,
    isPending,
    getResponseHeader,
  } = useUptimeChecks({
    orgSlug: organization.slug,
    projectSlug: uptimeRule.projectSlug,
    uptimeAlertId: uptimeRule.id,
    cursor: decodeScalar(location.query.cursor),
    ...timeRange,
    limit: 10,
  });

  if (isError) {
    return <LoadingError />;
  }

  const headers = [
    t('Status'),
    t('HTTP Status'),
    t('Checked At'),
    t('Duration'),
    t('Region'),
    t('Trace'),
  ];

  return (
    <Fragment>
      <SectionHeading>{t('Checks List')}</SectionHeading>
      <PanelTable
        headers={headers}
        isEmpty={!isPending && uptimeChecks.length === 0}
        emptyMessage={t('No uptime checks were reported for this time period.')}
      >
        {isPending
          ? [...new Array(headers.length * 10)].map((_, i) => (
              <RowPlaceholder key={i}>
                <Placeholder height="2rem" />
              </RowPlaceholder>
            ))
          : uptimeChecks.map(check => (
              <Fragment key={check.traceId}>
                <Status>
                  <StatusIndicator
                    status={checkStatusToIndicatorStatus[check.checkStatus]}
                    tooltipTitle={tct('Check-in Status: [status]', {
                      status: statusToText[check.checkStatus],
                    })}
                  />
                  <Text>
                    {statusToText[check.checkStatus]}{' '}
                    {check.checkStatusReason && (
                      <Fragment>
                        {'('}
                        <code>{check.checkStatusReason}</code>
                        {')'}
                      </Fragment>
                    )}
                  </Text>
                </Status>
                <div>{check.httpStatusCode ?? t('None')}</div>
                <div>
                  <DateTime date={check.timestamp} timeZone />
                </div>
                <div>
                  <Duration seconds={check.durationMs / 1000} abbreviation exact />
                </div>
                <div>{check.regionName}</div>
                <div>
                  <Link to={`/performance/trace/${check.traceId}/`}>
                    {getShortEventId(check.traceId)}
                  </Link>
                </div>
              </Fragment>
            ))}
      </PanelTable>
      <Pagination pageLinks={getResponseHeader?.('Link')} />
    </Fragment>
  );
}

const RowPlaceholder = styled('div')`
  grid-column: 1 / -1;
  padding: ${space(1)};

  &:not(:last-child) {
    border-bottom: solid 1px ${p => p.theme.innerBorder};
  }
`;

const Status = styled('div')`
  line-height: 1.1;
`;
