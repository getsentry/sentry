import DateTime from 'sentry/components/dateTime';
import {DataSection} from 'sentry/components/events/styles';
import Link from 'sentry/components/links/link';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {t, tct} from 'sentry/locale';
import {Event, Group, IssueType} from 'sentry/types';
import {defined} from 'sentry/utils';
import {formatPercentage} from 'sentry/utils/formatters';
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
    case IssueType.PERFORMANCE_DURATION_REGRESSION: {
      return (
        <EventStatisticalDetectorRegressedPerformanceMessage
          event={event}
          group={group}
        />
      );
    }
    case IssueType.PROFILE_FUNCTION_REGRESSION_EXPERIMENTAL: {
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
  const organization = useOrganization();

  const transactionName = event?.occurrence?.evidenceData?.transaction;
  const transactionSummaryLink = transactionSummaryRouteWithQuery({
    orgSlug: organization.slug,
    transaction: transactionName,
    query: {},
    trendFunction: 'p95',
    projectID: event.projectID,
    display: DisplayModes.TREND,
  });
  const detectionTime = new Date(event?.occurrence?.evidenceData?.breakpoint * 1000);

  return (
    <DataSection>
      <div style={{display: 'inline'}}>
        {tct(
          'Based on the transaction [transactionName], there was a [amount] increase in duration (P95) from [previousDuration] to [regressionDuration] around [date] at [time]. Overall operation percentage changes indicate what may have changed in the regression.',
          {
            transactionName: (
              <Link to={normalizeUrl(transactionSummaryLink)}>{transactionName}</Link>
            ),
            amount: formatPercentage(
              event?.occurrence?.evidenceData?.trendPercentage - 1
            ),
            previousDuration: (
              <PerformanceDuration
                abbreviation
                milliseconds={event?.occurrence?.evidenceData?.aggregateRange1}
              />
            ),
            regressionDuration: (
              <PerformanceDuration
                abbreviation
                milliseconds={event?.occurrence?.evidenceData?.aggregateRange2}
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

function EventStatisticalDetectorRegressedFunctionMessage({
  event,
}: EventStatisticalDetectorMessageProps) {
  const evidenceData = event?.occurrence?.evidenceData;
  const percentageChange = evidenceData?.trendPercentage;
  const detectionTime = new Date(evidenceData?.breakpoint * 1000);
  const functionName = evidenceData?.function as string;

  return (
    <DataSection>
      <div style={{display: 'inline'}}>
        {tct(
          '[functionName] had a [change] in duration (P95) from [before] to [after] around [date] at [time]. The example profiles may indicate what changed in the regression.',
          {
            functionName: <code>{functionName}</code>,
            change: defined(percentageChange)
              ? t('a %s increase', formatPercentage(percentageChange - 1))
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
