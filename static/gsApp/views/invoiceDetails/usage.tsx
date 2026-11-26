import {useId} from 'react';
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
import {UsageHistoryTables} from 'getsentry/views/subscriptionPage/usageHistory';

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
 * The period that a receipt billed, as the Usage History page shows a period.
 * Renders nothing without the invoice-usage-downloads feature, and nothing
 * when the receipt billed no usage.
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
    // The API answers 404 when the receipt billed no usage.
    if (error instanceof RequestError && error.status === 404) {
      return null;
    }
    return (
      <UsageSection>
        <LoadingError onRetry={isRetryableRequestError(error) ? refetch : undefined} />
      </UsageSection>
    );
  }
  return <InvoiceUsagePeriod usage={data} />;
}

/**
 * The billed period, its plan and the usage tables of the Usage History page.
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
      <UsageHistoryTables history={{...usage, categories}} />
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
