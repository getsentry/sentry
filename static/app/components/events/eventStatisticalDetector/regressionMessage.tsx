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
    projectID: event.projectID,
    display: DisplayModes.TREND,
  });
  const detectionTime = new Date(0);
  detectionTime.setUTCSeconds(event?.occurrence?.evidenceData?.breakpoint);

  // TODO: This messaging should respect selected locale in user settings
  return (
    <DataSection>
      <div style={{display: 'inline'}}>
        {tct(
          '[detected] Based on the transaction [transactionName], there was a [amount] increase in duration (P95) around [date] at [time] UTC. Overall operation percentage changes indicate what may have changed in the regression.',
          {
            detected: <strong>{t('Detected:')}</strong>,
            transactionName: (
              <Link to={normalizeUrl(transactionSummaryLink)}>{transactionName}</Link>
            ),
            amount: formatPercentage(
              event?.occurrence?.evidenceData?.trendPercentage / 100
            ),
            date: detectionTime.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            }),
            time: detectionTime.toLocaleTimeString(undefined, {
              hour12: true,
              hour: 'numeric',
              minute: 'numeric',
            }),
          }
        )}
      </div>
    </DataSection>
  );
}

export default EventStatisticalDetectorMessage;
