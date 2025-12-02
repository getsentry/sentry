import {Alert} from 'sentry/components/core/alert';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {tctCode} from 'sentry/locale';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';
import {useCanEditDetector} from 'sentry/views/detectors/utils/useCanEditDetector';

export const TRANSACTIONS_DATASET_DEPRECATION_MESSAGE = tctCode(
  'The transaction dataset is being deprecated. Please use Span alerts instead. Spans are a superset of transactions, you can isolate transactions by using the [code:is_transaction:true] filter. Please read these [FAQLink:FAQs] for more information.',
  {
    FAQLink: (
      <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/40366087871515-FAQ-Transactions-Spans-Migration" />
    ),
  }
);

export function TransactionsDatasetWarning() {
  const organization = useOrganization();
  const hasWarning = organization.features.includes(
    'performance-transaction-deprecation-banner'
  );
  if (!hasWarning) {
    return null;
  }

  return <Alert type="warning">{TRANSACTIONS_DATASET_DEPRECATION_MESSAGE}</Alert>;
}

export function MigratedAlertWarning({detector}: {detector: MetricDetector}) {
  const organization = useOrganization();
  const canEdit = useCanEditDetector({
    detectorType: detector.type,
    projectId: detector.projectId,
  });

  const editLink = `${makeMonitorDetailsPathname(organization.slug, detector.id)}edit/`;

  return (
    <Alert.Container>
      <Alert type="info">
        {tctCode(
          'To match the original behaviour, we’ve migrated this alert from a transaction-based alert to a span-based alert using a special compatibility mode. When you have a moment, please [editLink:edit] the alert updating its thresholds to account for [samplingLink:sampling].',
          {
            editLink: <Link to={editLink} disabled={!canEdit} />,
            samplingLink: (
              <ExternalLink
                href="https://docs.sentry.io/product/explore/trace-explorer/#how-sampling-affects-queries-in-trace-explorer"
                openInNewTab
              />
            ),
          }
        )}
      </Alert>
    </Alert.Container>
  );
}
