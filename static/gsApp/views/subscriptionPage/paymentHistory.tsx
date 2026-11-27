import {Fragment, useId, useState} from 'react';
import {IconCheckmark} from '@sentry/icons/checkmark';
import {IconChevron} from '@sentry/icons/chevron';
import {IconClose} from '@sentry/icons/close';
import {IconDownload} from '@sentry/icons/download';
import {IconTimer} from '@sentry/icons/timer';
import {IconWarning} from '@sentry/icons/warning';
import {skipToken, useQuery} from '@tanstack/react-query';
import moment from 'moment-timezone';
import {useQueryState} from 'nuqs';

import {Tag, type TagProps} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {Container, Flex, Stack, useResponsivePropValue} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Pagination} from '@sentry/scraps/pagination';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getPaginationProps} from 'sentry/utils/pagination';
import {isRetryableRequestError} from 'sentry/utils/queryClientConfig';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {capitalize} from 'sentry/utils/string/capitalize';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {useSubscription} from 'getsentry/hooks/useSubscription';
import type {InvoiceBase, InvoiceUsage, Plan, ReceiptType} from 'getsentry/types';
import {displayBudgetName} from 'getsentry/utils/billing';
import {formatCurrency} from 'getsentry/utils/formatCurrency';
import {trackGetsentryAnalytics} from 'getsentry/utils/trackGetsentryAnalytics';
import {ContactBillingMembers} from 'getsentry/views/contactBillingMembers';
import {SubscriptionPageContainer} from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';
import {PeriodUsageTable} from 'getsentry/views/subscriptionPage/usageHistory';

enum ReceiptStatus {
  PAID = 'paid',
  REFUNDED = 'refunded',
  CLOSED = 'closed',
  AWAITING_PAYMENT = 'awaiting_payment',
}

function ReceiptStatusTag({payment}: {payment: InvoiceBase}) {
  const status = payment.amountRefunded
    ? ReceiptStatus.REFUNDED
    : payment.isPaid
      ? ReceiptStatus.PAID
      : payment.isClosed
        ? ReceiptStatus.CLOSED
        : ReceiptStatus.AWAITING_PAYMENT;
  let icon = <IconWarning />;
  let tagType: TagProps['variant'] = 'warning';

  switch (status) {
    case ReceiptStatus.PAID:
      icon = <IconCheckmark />;
      tagType = 'success';
      break;
    case ReceiptStatus.CLOSED:
      icon = <IconClose />;
      tagType = 'danger';
      break;
    case ReceiptStatus.REFUNDED:
      icon = <IconTimer />;
      tagType = 'promotion';
      break;
    default:
      icon = <IconWarning />;
      tagType = 'warning';
      break;
  }

  return (
    <Tag icon={icon} variant={tagType}>
      {capitalize(status.replace('_', ' '))}
    </Tag>
  );
}

function getReceiptTypeLabel(receiptType: ReceiptType, plan: Plan | undefined) {
  switch (receiptType) {
    case 'payg':
      return displayBudgetName(plan, {title: true});
    case 'seer_token':
      return t('Seer auto-reload');
    case 'credit_grant':
      return t('Credit from Sentry');
    case 'subscription':
      return t('Subscription');
    default:
      return null;
  }
}

function UsageCsvDownloads({
  links,
  iconOnly,
}: {
  iconOnly: boolean;
  links: NonNullable<InvoiceBase['usageCsvLinks']>;
}) {
  const organization = useOrganization();
  const {projects, onSearch: onProjectSearch} = useProjects();

  return (
    <Fragment>
      <LinkButton
        icon={<IconDownload />}
        href={links.csv}
        aria-label={t('Download Usage CSV')}
        onClick={() =>
          trackGetsentryAnalytics('subscription_page.download_reports.clicked', {
            organization,
            reportType: 'summary',
          })
        }
      >
        {iconOnly ? undefined : t('Usage CSV')}
      </LinkButton>
      <CompactSelect
        strategy="fixed"
        trigger={triggerProps =>
          iconOnly ? (
            <OverlayTrigger.IconButton
              {...triggerProps}
              icon={<IconDownload />}
              aria-label={t('Download Project Usage CSV')}
            />
          ) : (
            <OverlayTrigger.Button
              {...triggerProps}
              icon={<IconDownload />}
              aria-label={t('Download Project Usage CSV')}
            >
              {t('Project Usage CSV')}
            </OverlayTrigger.Button>
          )
        }
        search={{placeholder: t('Filter projects'), onChange: onProjectSearch}}
        options={projects.map(project => ({
          value: project.slug,
          label: project.slug,
          textValue: project.slug,
        }))}
        value={undefined}
        onChange={(option: SelectOption<string>) => {
          trackGetsentryAnalytics('subscription_page.download_reports.clicked', {
            organization,
            reportType: 'project_breakdown',
          });
          window.open(`${links.csvPerProject}${option.value}/`, '_blank');
        }}
      />
    </Fragment>
  );
}

function UsageNotAvailable() {
  return (
    <Text variant="muted">{t('Usage details are not available for this receipt.')}</Text>
  );
}

/**
 * The usage table of the period that a receipt billed, as the Usage History page
 * shows it. A receipt shows no pay-as-you-go spend.
 */
function ReceiptUsage({invoiceId}: {invoiceId: string}) {
  const organization = useOrganization();
  const {data, error, isError, isPending, refetch} = useQuery(
    apiOptions.as<InvoiceUsage>()(
      '/customers/$organizationIdOrSlug/invoices/$invoiceId/usage/',
      {
        path: {organizationIdOrSlug: organization.slug, invoiceId},
        // The usage of a billed period does not change.
        staleTime: Infinity,
      }
    )
  );

  if (isPending) {
    return <LoadingIndicator mini />;
  }
  if (isError) {
    // The API answers 404 when the receipt billed no usage.
    if (error instanceof RequestError && error.status === 404) {
      return <UsageNotAvailable />;
    }
    return (
      <LoadingError onRetry={isRetryableRequestError(error) ? refetch : undefined} />
    );
  }
  // A legacy period without metric rows has no categories.
  const {categories} = data;
  if (!categories) {
    return <UsageNotAvailable />;
  }

  return (
    <Stack gap="xl">
      <Stack gap="sm">
        <Text variant="muted">
          {moment(data.periodStart).format('ll')} - {moment(data.periodEnd).format('ll')}
        </Text>
        <Text bold>{tct('[planName] Plan', {planName: data.planName})}</Text>
      </Stack>
      <PeriodUsageTable history={{...data, categories}} />
    </Stack>
  );
}

/**
 * Invoice/Payment list view.
 */
function PaymentHistory() {
  const organization = useOrganization();
  const [cursor] = useQueryState('cursor');
  const hasBillingPerms = organization.access?.includes('org:billing');

  const {data, isPending, isError, refetch} = useQuery({
    ...apiOptions.as<InvoiceBase[]>()('/customers/$organizationIdOrSlug/invoices/', {
      path: hasBillingPerms ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {cursor: cursor ?? undefined},
      staleTime: 0,
    }),
    select: selectJsonWithHeaders,
  });

  const paymentsPageLinks = data?.headers.Link;

  return (
    <SubscriptionPageContainer>
      <SentryDocumentTitle title={t('Receipts')} orgSlug={organization.slug} />
      <SettingsPageHeader title={t('Receipts')} />
      {hasBillingPerms ? (
        <Fragment>
          <ReceiptTable
            isError={isError}
            isPending={isPending}
            onRetry={refetch}
            organization={organization}
            payments={data?.json}
          />
          {paymentsPageLinks && <Pagination {...getPaginationProps(paymentsPageLinks)} />}
        </Fragment>
      ) : (
        <ContactBillingMembers />
      )}
    </SubscriptionPageContainer>
  );
}

const EXPAND_COLUMN: TableColumnConfig = {key: 'expand', width: 'min-content'};

const COLUMNS: TableColumnConfig[] = [
  {key: 'date', width: 'minmax(min-content, 1fr)'},
  {key: 'type', width: 'minmax(max-content, 1fr)', visible: {sm: true}},
  {key: 'amount', width: 'minmax(max-content, 1fr)'},
  {
    key: 'status',
    width: {zero: 'minmax(112px, max-content)', sm: 'minmax(max-content, 1fr)'},
  },
  {key: 'receiptId', width: 'minmax(0, 1fr)', visible: {sm: true}},
  {key: 'download', width: {zero: 'max-content', xl: 'minmax(max-content, 2fr)'}},
];

const COLUMNS_WITHOUT_TYPE = COLUMNS.filter(column => column.key !== 'type');

export function ReceiptTable({
  initialExpandedId,
  isError,
  isPending,
  onRetry,
  organization,
  payments,
}: {
  isError: boolean;
  isPending: boolean;
  onRetry: () => void;
  organization: Organization;
  payments: InvoiceBase[] | undefined;
  /**
   * The receipt whose usage starts expanded. Visual snapshots set it because
   * they cannot click.
   */
  initialExpandedId?: string;
}) {
  const isSmallContainer = useResponsivePropValue({zero: true, xl: false});
  // Only token-billed Seer has auto-reloads and credit grants to tell apart.
  const showReceiptType = organization.features.includes('token-billed-seer-enabled');
  const hasUsageDownloads = organization.features.includes('invoice-usage-downloads');
  const subscription = useSubscription();

  return (
    <SimpleTable
      aria-label={t('Receipts')}
      columns={[
        ...(hasUsageDownloads ? [EXPAND_COLUMN] : []),
        ...(showReceiptType ? COLUMNS : COLUMNS_WITHOUT_TYPE),
      ]}
      data-test-id="payment-list"
      scrollable
      header={
        <SimpleTable.HeaderRow>
          {hasUsageDownloads && <SimpleTable.HeaderCell />}
          <SimpleTable.HeaderCell>{t('Date')}</SimpleTable.HeaderCell>
          {showReceiptType && (
            <SimpleTable.HeaderCell>{t('Type')}</SimpleTable.HeaderCell>
          )}
          <SimpleTable.HeaderCell align="right">{t('Amount')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Status')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Receipt ID')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell />
        </SimpleTable.HeaderRow>
      }
    >
      {isError ? (
        <SimpleTable.Error onRetry={onRetry} />
      ) : isPending ? (
        <SimpleTable.Loading />
      ) : payments?.length ? (
        payments.map(payment => (
          <ReceiptRow
            key={payment.id}
            defaultExpanded={payment.id === initialExpandedId}
            hasUsageDownloads={hasUsageDownloads}
            isSmallContainer={isSmallContainer}
            organization={organization}
            payment={payment}
            plan={subscription?.planDetails}
            showReceiptType={showReceiptType}
          />
        ))
      ) : (
        <SimpleTable.Empty>{t('No receipts found')}</SimpleTable.Empty>
      )}
    </SimpleTable>
  );
}

function ReceiptRow({
  defaultExpanded,
  hasUsageDownloads,
  isSmallContainer,
  organization,
  payment,
  plan,
  showReceiptType,
}: {
  defaultExpanded: boolean;
  hasUsageDownloads: boolean;
  isSmallContainer: boolean;
  organization: Organization;
  payment: InvoiceBase;
  plan: Plan | undefined;
  showReceiptType: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const usageRowId = useId();
  const usageCsvLinks = hasUsageDownloads ? payment.usageCsvLinks : null;
  const date = moment(payment.dateCreated).format('MMM D, YYYY');

  return (
    <Fragment>
      <SimpleTable.Row>
        {hasUsageDownloads && (
          <SimpleTable.RowCell paddingRight="0">
            {usageCsvLinks && (
              <Button
                size="xs"
                variant="transparent"
                icon={<IconChevron direction={isExpanded ? 'down' : 'right'} />}
                aria-label={t('Usage for the %s receipt', date)}
                aria-expanded={isExpanded}
                aria-controls={isExpanded ? usageRowId : undefined}
                onClick={() => setIsExpanded(!isExpanded)}
              />
            )}
          </SimpleTable.RowCell>
        )}
        <SimpleTable.RowCell>
          <Link to={`/settings/${organization.slug}/billing/receipts/${payment.id}/`}>
            {date}
          </Link>
        </SimpleTable.RowCell>
        {showReceiptType && (
          <SimpleTable.RowCell>
            {payment.receiptType && (
              <Text>{getReceiptTypeLabel(payment.receiptType, plan)}</Text>
            )}
          </SimpleTable.RowCell>
        )}
        <SimpleTable.RowCell justify="end">
          <Container>
            <Text align="right">{formatCurrency(payment.amountBilled ?? 0)}</Text>
            {!!payment.amountRefunded && (
              <Text size="sm" align="right">
                {tct('[amount] refunded', {
                  amount: formatCurrency(payment.amountRefunded),
                })}
              </Text>
            )}
          </Container>
        </SimpleTable.RowCell>
        <SimpleTable.RowCell>
          <ReceiptStatusTag payment={payment} />
        </SimpleTable.RowCell>
        <SimpleTable.RowCell>
          <Text monospace ellipsis>
            {payment.id}
          </Text>
        </SimpleTable.RowCell>
        <SimpleTable.RowCell justify="end">
          <Flex justify="end" gap="md" wrap="wrap">
            {usageCsvLinks && (
              <UsageCsvDownloads links={usageCsvLinks} iconOnly={isSmallContainer} />
            )}
            <LinkButton
              aria-label={t('Download PDF')}
              icon={<IconDownload />}
              href={payment.receipt.url}
            >
              {isSmallContainer ? undefined : t('Download PDF')}
            </LinkButton>
          </Flex>
        </SimpleTable.RowCell>
      </SimpleTable.Row>
      {isExpanded && (
        <SimpleTable.FullWidthRow id={usageRowId}>
          {/* Keep the fixed-layout usage table from sizing the receipt columns. */}
          <Container padding="xl" contain="inline-size">
            <ReceiptUsage invoiceId={payment.id} />
          </Container>
        </SimpleTable.FullWidthRow>
      )}
    </Fragment>
  );
}

export default PaymentHistory;
