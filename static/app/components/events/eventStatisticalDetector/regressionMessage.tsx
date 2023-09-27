import DateTime from 'sentry/components/dateTime';
import {DataSection} from 'sentry/components/events/styles';
import Link from 'sentry/components/links/link';
import {t, tct} from 'sentry/locale';
import {Event} from 'sentry/types';
import {formatPercentage} from 'sentry/utils/formatters';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {
  DisplayModes,
  transactionSummaryRouteWithQuery,
} from 'sentry/views/performance/transactionSummary/utils';

type EventStatisticalDetectorMessageProps = {
  event: Event;
};

function EventStatisticalDetectorMessage({event}: EventStatisticalDetectorMessageProps) {
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
          '[detected] Based on the transaction [transactionName], there was a [amount] increase in duration (P95) around [date] at [time]. Overall operation percentage changes indicate what may have changed in the regression.',
          {
            detected: <strong>{t('Detected:')}</strong>,
            transactionName: (
              <Link to={normalizeUrl(transactionSummaryLink)}>{transactionName}</Link>
            ),
            amount: formatPercentage(
              event?.occurrence?.evidenceData?.trendPercentage - 1
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
