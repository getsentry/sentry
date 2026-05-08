import {Fragment} from 'react';
import styled from '@emotion/styled';
import {keepPreviousData, useQuery} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {Flex, Stack, Grid} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Pagination} from '@sentry/scraps/pagination';
import {Text, Heading} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {LogoSentry} from 'sentry/components/logoSentry';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {IconCheckmark, IconTimer} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import type {
  BillingDetails,
  Invoice,
  InvoiceBase,
  InvoiceItem,
  InvoiceItemType,
} from 'getsentry/types';
import {getTaxFieldInfo} from 'getsentry/utils/salesTax';
import {displayPriceWithCents} from 'getsentry/views/amCheckout/utils';
import {SubscriptionPageContainer} from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';

import {InvoiceDetailsActions} from './actions';

function InvoiceDetails() {
  const {invoiceGuid} = useParams<{invoiceGuid: string}>();

  const organization = useOrganization();
  const navigate = useNavigate();

  const {data: invoiceList} = useQuery(
    // Use apiOptions so the cache key matches paymentHistory.tsx's list query,
    // avoiding a redundant network request when navigating from the receipts list.
    apiOptions.as<InvoiceBase[]>()('/customers/$organizationIdOrSlug/invoices/', {
      path: {organizationIdOrSlug: organization.slug},
      staleTime: 60_000,
    })
  );

  const currentIndex = invoiceList
    ? invoiceList.findIndex(inv => inv.id === invoiceGuid)
    : -1;
  // The list is newest-first, so "previous" is the older receipt (higher index)
  // and "next" is the more recent receipt (lower index).
  const prevId =
    invoiceList && currentIndex >= 0 && currentIndex < invoiceList.length - 1
      ? invoiceList[currentIndex + 1]!.id
      : null;
  const nextId =
    invoiceList && currentIndex > 0 ? invoiceList[currentIndex - 1]!.id : null;

  function receiptUrl(id: string) {
    return `/settings/${organization.slug}/billing/receipts/${id}/`;
  }

  // Build a synthetic Link header string so <Pagination> can derive
  // disabled state from results="false" / results="true".
  // parseLinkHeader reads the cursor from the ; cursor="…" attribute, not the URL.
  const pageLinks = invoiceList
    ? [
        prevId
          ? `<.>; rel="previous"; results="true"; cursor="${prevId}"`
          : `<.>; rel="previous"; results="false"`,
        nextId
          ? `<.>; rel="next"; results="true"; cursor="${nextId}"`
          : `<.>; rel="next"; results="false"`,
      ].join(', ')
    : null;

  const {
    data: billingDetails,
    isPending: isBillingDetailsLoading,
    isError: isBillingDetailsError,
    refetch: billingDetailsRefetch,
  } = useApiQuery<BillingDetails>(
    [
      getApiUrl('/customers/$organizationIdOrSlug/billing-details/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
    ],
    {
      staleTime: 0,
      placeholderData: keepPreviousData,
    }
  );
  const {
    data: invoice,
    isPending: isInvoiceLoading,
    isError: isInvoiceError,
    refetch: invoiceRefetch,
  } = useApiQuery<Invoice>(
    [
      getApiUrl('/customers/$organizationIdOrSlug/invoices/$invoiceId/', {
        path: {organizationIdOrSlug: organization.slug, invoiceId: invoiceGuid},
      }),
    ],
    {
      staleTime: Infinity,
    }
  );

  if (isBillingDetailsError || isInvoiceError) {
    return (
      <SubscriptionPageContainer background="secondary">
        <LoadingError
          onRetry={() => {
            billingDetailsRefetch();
            invoiceRefetch();
          }}
        />
      </SubscriptionPageContainer>
    );
  }

  return (
    <SubscriptionPageContainer background="secondary">
      <SettingsPageHeader
        title={t('Receipt Details')}
        action={
          <InvoicePagination
            pageLinks={pageLinks}
            onCursor={cursor => cursor && navigate(receiptUrl(cursor))}
          />
        }
      />
      <Flex justify="center" padding="3xl">
        {isInvoiceLoading || isBillingDetailsLoading ? (
          <PanelBody withPadding>
            <LoadingIndicator />
          </PanelBody>
        ) : (
          <Stack maxWidth="720px" border="primary" radius="xl">
            <Stack padding="2xl" gap="2xl">
              <Flex justify="between">
                <Stack gap="lg" align="start">
                  <LogoSentry height="24px" />
                  <Stack>
                    <Text size="sm" variant="secondary">
                      {invoice.sender.address.join(', ')}
                    </Text>
                    {invoice.sentryTaxIds && (
                      <Text size="sm" variant="secondary">
                        {invoice.sentryTaxIds.taxIdName}: {invoice.sentryTaxIds.taxId}
                      </Text>
                    )}
                    {invoice.sentryTaxIds?.region && (
                      <Text>
                        {invoice.sentryTaxIds.region.taxIdName}:{' '}
                        {invoice.sentryTaxIds.region.taxId}
                      </Text>
                    )}
                  </Stack>
                </Stack>
                <Stack align="end" gap="sm">
                  <Text size="sm" variant="muted" monospace>
                    {invoice.id}
                  </Text>
                  {invoice.isPaid ? (
                    <Tag variant="success" icon={<IconCheckmark />}>
                      {t('Paid in full')}
                    </Tag>
                  ) : (
                    <Tag variant="warning" icon={<IconTimer />}>
                      {t('Waiting for payment')}
                    </Tag>
                  )}
                </Stack>
              </Flex>
              <Stack>
                <Heading as="h2" size="3xl">
                  {displayPriceWithCents({cents: invoice.amountBilled ?? 0})} USD
                </Heading>
                <Text size="md" variant="secondary">
                  {t('Charged')} <DateTime date={invoice.dateCreated} dateOnly year />.
                </Text>
              </Stack>
            </Stack>

            <InvoiceDetailsContents invoice={invoice} billingDetails={billingDetails} />

            {invoice && (
              <InvoiceDetailsActions
                organization={organization}
                invoice={invoice}
                reloadInvoice={invoiceRefetch}
              />
            )}
            <Stack padding="xl 2xl" borderTop="primary">
              <Text size="xs" variant="secondary">
                {tct(
                  'Your subscription will automatically renew on or about the same day each [period] and your credit card on file will be charged the recurring subscription fees set forth above. In addition to recurring subscription fees, you may also be charged for monthly [budgetTerm] fees. You may cancel your subscription at any time [here:here].',
                  {
                    budgetTerm:
                      'planDetails' in invoice.customer
                        ? invoice.customer.planDetails.budgetTerm
                        : 'pay-as-you-go',
                    period:
                      'billingInterval' in invoice.customer &&
                      invoice.customer.billingInterval === 'annual'
                        ? 'year'
                        : 'month',
                    here: (
                      <ExternalLink
                        href={`/settings/${organization.slug}/billing/cancel/`}
                      />
                    ),
                  }
                )}
              </Text>
            </Stack>
          </Stack>
        )}
      </Flex>
    </SubscriptionPageContainer>
  );
}

type AttributeProps = {
  invoice: Invoice;
  billingDetails?: BillingDetails;
};

function InvoiceAttributes({invoice, billingDetails}: AttributeProps) {
  const contactInfo = invoice?.displayAddress || billingDetails?.displayAddress;
  const companyName = billingDetails?.companyName;
  const billingEmail = billingDetails?.billingEmail;
  const taxNumber = invoice?.taxNumber;
  const countryCode = invoice?.countryCode || billingDetails?.countryCode;
  const taxNumberName = `${getTaxFieldInfo(countryCode).label}:`;

  return (
    <Grid columns="1fr 1fr" gap="3xl" padding="2xl" borderTop="primary">
      {(companyName || contactInfo || taxNumber) && (
        <Stack gap="lg">
          <Text bold>{t('Billed to')}</Text>
          <Stack gap="sm">
            {!!companyName && <Text>{companyName}</Text>}
            {!!contactInfo && (
              <Text size="sm" variant="secondary">
                {contactInfo}
              </Text>
            )}
            {!!taxNumber && (
              <Text size="sm" variant="secondary">
                {taxNumberName}: {taxNumber}
              </Text>
            )}
          </Stack>
        </Stack>
      )}

      <Stack gap="lg">
        <Text bold>{t('Account')}</Text>
        <Stack gap="sm">
          {invoice.customer?.name && <Text>{invoice.customer.name}</Text>}
          <Text size="sm" variant="secondary">
            {billingEmail}
          </Text>
        </Stack>
      </Stack>
    </Grid>
  );
}

type ContentsProps = {
  invoice: Invoice;
  billingDetails?: BillingDetails;
};

type ItemBucket = 'subscription' | 'usage' | 'adjustment';

function bucketFor(type: InvoiceItemType): ItemBucket {
  if (type === 'subscription' || type.startsWith('reserved_')) {
    return 'subscription';
  }
  if (type.startsWith('ondemand_') || type === 'ondemand') {
    return 'usage';
  }
  return 'adjustment';
}

function groupItems(items: InvoiceItem[]): Record<ItemBucket, InvoiceItem[]> {
  const groups: Record<ItemBucket, InvoiceItem[]> = {
    subscription: [],
    usage: [],
    adjustment: [],
  };
  for (const item of items) {
    groups[bucketFor(item.type)].push(item);
  }
  return groups;
}

function sectionPeriod(items: InvoiceItem[]) {
  const starts = items.map(i => i.periodStart).filter(Boolean);
  const ends = items.map(i => i.periodEnd).filter(Boolean);
  if (!starts.length || !ends.length) {
    return null;
  }
  return {
    start: starts.reduce((a, b) => (a < b ? a : b)),
    end: ends.reduce((a, b) => (a > b ? a : b)),
  };
}

function sumAmounts(items: InvoiceItem[]) {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

function InvoiceDetailsContents({billingDetails, invoice}: ContentsProps) {
  const groups = groupItems(invoice.items);
  const subtotal = sumAmounts([...groups.subscription, ...groups.usage]);

  return (
    <Fragment>
      <InvoiceAttributes invoice={invoice} billingDetails={billingDetails} />

      {groups.subscription.length > 0 && (
        <InvoiceItemSection
          title={t('Subscription')}
          description={t('Recurring charges for your plan and reserved volume.')}
          period={sectionPeriod(groups.subscription)}
          items={groups.subscription}
          showQuantityAndRate
        />
      )}

      {groups.usage.length > 0 && (
        <InvoiceItemSection
          title={t('Additional usage')}
          description={t(
            'Volume from the previous billing cycle that exceeded your reserved limits, billed now that the period has closed.'
          )}
          period={sectionPeriod(groups.usage)}
          items={groups.usage}
        />
      )}

      <Stack borderTop="primary" background="secondary" padding="2xl 2xl 0 2xl">
        <SubtotalItems>
          <tbody>
            <tr>
              <td>
                <Text bold>{t('Subtotal')}</Text>
              </td>
              <td>{displayPriceWithCents({cents: subtotal})}</td>
            </tr>
            {groups.adjustment.map((item, i) => {
              const isCredit = item.amount < 0;
              return (
                <tr key={i}>
                  <td>
                    <Text>{item.description}</Text>
                  </td>
                  <td>
                    <Text variant={isCredit ? 'success' : undefined}>
                      {displayPriceWithCents({cents: item.amount})}
                    </Text>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </SubtotalItems>
      </Stack>
      <Stack background="secondary" padding="0 2xl">
        <InvoiceTotals invoice={invoice} />
      </Stack>
    </Fragment>
  );
}

type SectionProps = {
  description: string;
  items: InvoiceItem[];
  period: {end: string; start: string} | null;
  title: string;
  showQuantityAndRate?: boolean;
};

function parseQuantity(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// Strip a leading number (and optional unit like "GB") from descriptions like
// "50,000 reserved errors" or "1 GB reserved attachments" — the number lives
// in the Qty column, so repeating it is noisy.
function stripLeadingQuantity(description: string): string {
  const stripped = description.replace(/^[\d,]+(?:\.\d+)?\s*(?:GB|MB|KB|TB)?\s+/i, '');
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

function InvoiceItemSection({
  title,
  description,
  period,
  items,
  showQuantityAndRate,
}: SectionProps) {
  return (
    <Stack borderTop="primary">
      <Flex justify="between" padding="2xl" gap="3xl">
        <Stack gap="sm">
          <Heading as="h3" size="md">
            {title}
          </Heading>
          <Text variant="secondary">{description}</Text>
        </Stack>
        {period && (
          <Text size="sm" variant="secondary" wrap="nowrap">
            <DateTime date={period.start} dateOnly year /> –{' '}
            <DateTime date={period.end} dateOnly year />
          </Text>
        )}
      </Flex>
      <Stack padding="0 2xl">
        <InvoiceItems>
          <thead>
            <tr>
              <th>
                <Text size="sm" variant="secondary" uppercase bold>
                  {t('Item')}
                </Text>
              </th>
              {showQuantityAndRate && (
                <th>
                  <Text size="sm" variant="secondary" uppercase bold>
                    {t('Qty')}
                  </Text>
                </th>
              )}
              {showQuantityAndRate && (
                <th>
                  <Text size="sm" variant="secondary" uppercase bold>
                    {t('Rate')}
                  </Text>
                </th>
              )}
              <th>
                <Text size="sm" variant="secondary" uppercase bold>
                  {t('Amount (USD)')}
                </Text>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const quantity = parseQuantity(item.data?.quantity);
              return (
                <tr key={i}>
                  <td>
                    {item.type === 'subscription'
                      ? tct('[description] Plan', {
                          description: item.description.replace(
                            /^Subscription to\s+/i,
                            ''
                          ),
                        })
                      : showQuantityAndRate
                        ? stripLeadingQuantity(item.description)
                        : item.description}
                  </td>
                  {showQuantityAndRate && (
                    <td>{quantity === null ? '—' : quantity.toLocaleString()}</td>
                  )}
                  {showQuantityAndRate && (
                    <td>
                      <Text variant="secondary">
                        {item.amount === 0 && quantity !== null && quantity > 0
                          ? t('Included')
                          : quantity !== null && quantity > 0
                            ? displayPriceWithCents({
                                cents: item.amount / quantity,
                                maximumFractionDigits: 5,
                              })
                            : '—'}
                      </Text>
                    </td>
                  )}
                  <td>{displayPriceWithCents({cents: item.amount})}</td>
                </tr>
              );
            })}
          </tbody>
        </InvoiceItems>
      </Stack>
    </Stack>
  );
}

function InvoiceTotals({invoice}: {invoice: Invoice}) {
  // If an Invoice has 'isReverseCharge: true', it should be noted in
  // the last row of the table with "VAT" in the left column and "Reverse Charge"
  // on the right underneath the totals and (if included) refunds
  return (
    <Stack borderTop="primary">
      <InvoiceItems data-test-id="invoice-items">
        <tbody>
          <tr>
            <th>
              <Text size="xl" bold>
                {t('Total')}
              </Text>
            </th>
            <td>
              <Text size="xl" bold>
                {displayPriceWithCents({cents: invoice.amountBilled ?? 0})}
              </Text>
            </td>
          </tr>
          {invoice.isRefunded && (
            <tr>
              <td>
                <Text bold>{t('Refunds')}</Text>
              </td>
              <td>
                <Text variant="success">
                  -{displayPriceWithCents({cents: invoice.amountRefunded})}
                </Text>
              </td>
            </tr>
          )}
          {invoice.isReverseCharge && (
            <tr>
              <th>{invoice.defaultTaxName}</th>
              <td>{t('Reverse Charge')}</td>
            </tr>
          )}
        </tbody>
      </InvoiceItems>
    </Stack>
  );
}

export default InvoiceDetails;

const InvoiceItems = styled('table')`
  width: 100%;
  padding: ${p => p.theme.space['2xl']};

  thead {
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }

  th:not(:first-child),
  td:not(:first-child) {
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  td,
  th {
    padding: ${p => p.theme.space['lg']} 0;
  }

  td {
    border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  }

  tfoot th,
  tfoot td {
    text-align: right;
  }
`;

const SubtotalItems = styled(InvoiceItems)`
  td,
  th {
    padding: ${p => p.theme.space.sm} 0;
    border-top: none;
  }
`;

// Strip the default top margin from Pagination so it sits cleanly in the
// SettingsPageHeader action slot without extra spacing.
const InvoicePagination = styled(Pagination)`
  margin: 0;
`;
