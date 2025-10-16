import {Alert} from 'sentry/components/core/alert';
import {ExternalLink} from 'sentry/components/core/link';
import {tctCode} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

export function TransactionsDatasetWarning() {
  const organization = useOrganization();
  const hasWarning = organization.features.includes(
    'performance-transaction-deprecation-banner'
  );
  if (!hasWarning) {
    return null;
  }

  return (
    <Alert type="warning">
      {tctCode(
        'The transaction dataset is being deprecated. Please use Span alerts instead. Spans are a superset of transactions, you can isolate transactions by using the [code:is_transaction:true] filter. Please read these [FAQLink:FAQs] for more information.',
        {
          FAQLink: (
            <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/40366087871515-FAQ-Transactions-Spans-Migration" />
          ),
        }
      )}
    </Alert>
  );
}
