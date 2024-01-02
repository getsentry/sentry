import {useMemo} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import DateTime from 'sentry/components/dateTime';
import {DataSection} from 'sentry/components/events/styles';
import Link from 'sentry/components/links/link';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {Tooltip} from 'sentry/components/tooltip';
import {IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Group, IssueType} from 'sentry/types';
import {defined} from 'sentry/utils';
import {formatPercentage} from 'sentry/utils/formatters';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {
  DisplayModes,
  transactionSummaryRouteWithQuery,
} from 'sentry/views/performance/transactionSummary/utils';

type EventStatisticalDetectorMessageProps = {
  event: Event;
  group: Group;
};

function EventStatisticalDetectorMessage({
  event,
  group,
}: EventStatisticalDetectorMessageProps) {
  switch (group.issueType) {
    case IssueType.PERFORMANCE_DURATION_REGRESSION:
    case IssueType.PERFORMANCE_ENDPOINT_REGRESSION: {
      return (
        <EventStatisticalDetectorRegressedPerformanceMessage
          event={event}
          group={group}
        />
      );
    }
    case IssueType.PROFILE_FUNCTION_REGRESSION_EXPERIMENTAL:
    case IssueType.PROFILE_FUNCTION_REGRESSION: {
      return (
        <EventStatisticalDetectorRegressedFunctionMessage event={event} group={group} />
      );
    }
    default: {
      return null;
    }
  }
}

function EventStatisticalDetectorRegressedPerformanceMessage({
  event,
}: EventStatisticalDetectorMessageProps) {
  const now = useMemo(() => new Date(), []);

  const organization = useOrganization();

  const {transaction, breakpoint, aggregateRange1, aggregateRange2, trendPercentage} =
    event?.occurrence?.evidenceData ?? {};

  const {end: afterDateTime} = useRelativeDateTime({
    anchor: breakpoint,
    relativeDays: 14,
  });

  const transactionSummaryLink = transactionSummaryRouteWithQuery({
    orgSlug: organization.slug,
    transaction,
    query: {},
    trendFunction: 'p95',
    projectID: event.projectID,
    display: DisplayModes.TREND,
  });
  const detectionTime = new Date(breakpoint * 1000);

  return (
    <DataSection>
      <Message>
        <span>
          {tct(
            'Based on the transaction [transactionName], there was a [absoluteChange] ([percentageAmount]) increase in duration (P95) from [previousDuration] to [regressionDuration] around [date] at [time]. Overall operation percentage changes indicate what may have changed in the regression.',
            {
              transactionName: (
                <Link to={normalizeUrl(transactionSummaryLink)}>{transaction}</Link>
              ),
              absoluteChange: (
                <PerformanceDuration
                  abbreviation
                  milliseconds={aggregateRange2 - aggregateRange1}
                />
              ),
              percentageAmount: formatPercentage(trendPercentage - 1),
              previousDuration: (
                <PerformanceDuration abbreviation milliseconds={aggregateRange1} />
              ),
              regressionDuration: (
                <PerformanceDuration abbreviation milliseconds={aggregateRange2} />
              ),
              date: <DateTime date={detectionTime} dateOnly />,
              time: <DateTime date={detectionTime} timeOnly />,
            }
          )}
        </span>
        {afterDateTime && now > afterDateTime && (
          <Tooltip
            title={t(
              'The current date is over 14 days from the breakpoint. Open the Transaction Summary to see the most up to date transaction behaviour.'
            )}
          >
            <LinkButton to={transactionSummaryLink} size="xs" icon={<IconOpen />}>
              {t('Go to Summary')}
            </LinkButton>
          </Tooltip>
        )}
      </Message>
    </DataSection>
  );
}

const Message = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  align-items: baseline;
`;

function EventStatisticalDetectorRegressedFunctionMessage({
  event,
}: EventStatisticalDetectorMessageProps) {
  const evidenceData = event?.occurrence?.evidenceData;
  const absoluteChange = evidenceData?.trendDifference;
  const percentageChange = evidenceData?.trendPercentage;
  const detectionTime = new Date(evidenceData?.breakpoint * 1000);
  const functionName = evidenceData?.function as string;

  return (
    <DataSection>
      <div style={{display: 'inline'}}>
        {tct(
          '[functionName] had [change] in duration (P95) from [before] to [after] around [date] at [time]. The example profiles may indicate what changed in the regression.',
          {
            functionName: <code>{functionName}</code>,
            change:
              defined(absoluteChange) && defined(percentageChange)
                ? t(
                    'a %s (%s) increase',
                    <PerformanceDuration abbreviation nanoseconds={absoluteChange} />,
                    formatPercentage(percentageChange - 1)
                  )
                : t('an increase'),
            before: (
              <PerformanceDuration
                abbreviation
                nanoseconds={evidenceData?.aggregateRange1 ?? 0}
              />
            ),
            after: (
              <PerformanceDuration
                abbreviation
                nanoseconds={evidenceData?.aggregateRange2 ?? 0}
              />
            ),
            date: <DateTime date={detectionTime} dateOnly />,
            time: <DateTime date={detectionTime} timeOnly />,
          }
        )}
      </div>
    </DataSection>
  );
}

export default EventStatisticalDetectorMessage;
