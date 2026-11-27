import {useId, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {isRetryableRequestError} from 'sentry/utils/queryClientConfig';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {InvoiceUsage} from 'getsentry/types';
import {PeriodUsageTable} from 'getsentry/views/subscriptionPage/usageHistory';

type Props = {
  invoiceId: string;
  /**
   * True while the receipt above loads. The usage request does not wait for
   * the receipt, but the section does: it never shows below the receipt's
   * spinner.
   */
  isReceiptLoading: boolean;
};

/**
 * The section that shows the usage table of the period that a receipt billed.
 * Renders nothing without the invoice-usage-downloads feature, and nothing
 * when the receipt billed no usage, unless a usage request failed first: then
 * the section says that the receipt billed no usage.
 */
export function InvoiceDetailsUsage({invoiceId, isReceiptLoading}: Props) {
  const organization = useOrganization();
  const hasFeature = organization.features.includes('invoice-usage-downloads');
  const {data, error, failureCount, isError, isFetchedAfterMount, isPending, refetch} =
    useQuery({
      ...apiOptions.as<InvoiceUsage>()(
        '/customers/$organizationIdOrSlug/invoices/$invoiceId/usage/',
        {
          path: {organizationIdOrSlug: organization.slug, invoiceId},
          // The usage of a billed period does not change.
          staleTime: Infinity,
        }
      ),
      enabled: hasFeature,
    });
  // True after you click Retry. The page mounts this component again for each
  // receipt, so a Retry does not carry over to the next receipt.
  const [retried, setRetried] = useState(false);

  if (!hasFeature || isReceiptLoading) {
    return null;
  }
  if (isPending) {
    // The first request shows no spinner: for a receipt without usage, the
    // spinner would only go away again. A request after a failure shows the
    // section with a spinner: failureCount counts the failures before an
    // automatic retry, and isFetchedAfterMount is true after Retry. Not
    // errorUpdateCount: the query cache keeps it, so a second visit to a 404
    // receipt would show a spinner.
    return failureCount > 0 || isFetchedAfterMount ? (
      <UsageSection>
        <LoadingIndicator />
      </UsageSection>
    ) : null;
  }
  if (isError) {
    // The API answers 404 when the receipt billed no usage. A first 404 shows
    // nothing. When a failed request came before the 404, the section may
    // already show a spinner or an error box, so it says why it stays empty
    // rather than go away. failureCount counts this 404 too, so more than 1
    // means that an earlier request failed. The note is true only if the API
    // answers a failed read with 5xx, not 404.
    if (error instanceof RequestError && error.status === 404) {
      return retried || failureCount > 1 ? <InvoiceNoUsage /> : null;
    }
    return (
      <UsageSection>
        <LoadingError
          onRetry={
            isRetryableRequestError(error)
              ? () => {
                  setRetried(true);
                  refetch();
                }
              : undefined
          }
        />
      </UsageSection>
    );
  }
  return <InvoiceUsagePeriod usage={data} />;
}

/**
 * The billed period, its plan and the usage table of the Usage History page.
 * The receipt above lists the pay-as-you-go charges, so the section shows no
 * spend table.
 */
export function InvoiceUsagePeriod({usage}: {usage: InvoiceUsage}) {
  const {categories} = usage;
  // The API leaves out the categories when the period has no usage rows.
  if (!categories) {
    return null;
  }

  return (
    <UsageSection>
      <Stack gap="sm">
        <Text variant="muted">
          {moment(usage.periodStart).format('ll')} -{' '}
          {moment(usage.periodEnd).format('ll')}
        </Text>
        <Text bold>{tct('[planName] Plan', {planName: usage.planName})}</Text>
      </Stack>
      <PeriodUsageTable history={{...usage, categories}} />
    </UsageSection>
  );
}

/**
 * The section of a receipt that billed no usage, after a usage request failed.
 */
export function InvoiceNoUsage() {
  return (
    <UsageSection>
      <Text>{t('This receipt billed no usage.')}</Text>
    </UsageSection>
  );
}

function UsageSection({children}: {children: React.ReactNode}) {
  const headingId = useId();

  return (
    <Stack
      as="section"
      aria-labelledby={headingId}
      gap="xl"
      padding="xl"
      background="primary"
      border="primary"
      radius="md"
    >
      <Heading as="h2" size="lg" id={headingId}>
        {t('Usage billed on this receipt')}
      </Heading>
      {children}
    </Stack>
  );
}
