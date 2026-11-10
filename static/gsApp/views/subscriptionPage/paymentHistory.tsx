import {Fragment, useState} from 'react';
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
import {Container, Flex, Grid, useResponsivePropValue} from '@sentry/scraps/layout';
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
import {capitalize} from 'sentry/utils/string/capitalize';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import type {InvoiceBase, InvoiceUsage} from 'getsentry/types';
import {formatCurrency} from 'getsentry/utils/formatCurrency';
import {trackGetsentryAnalytics} from 'getsentry/utils/trackGetsentryAnalytics';
import {ContactBillingMembers} from 'getsentry/views/contactBillingMembers';
import {SubscriptionPageContainer} from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';

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
        search={{
          placeholder: t('Filter projects'),
          onChange: onProjectSearch,
        }}
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

function ReceiptUsageBreakdown({invoiceId}: {invoiceId: string}) {
  const organization = useOrganization();
  const {data, isPending, isError, refetch} = useQuery(
    apiOptions.as<InvoiceUsage>()(
      '/customers/$organizationIdOrSlug/invoices/$invoiceId/usage/',
      {
        path: {organizationIdOrSlug: organization.slug, invoiceId},
        staleTime: Infinity,
      }
    )
  );

  if (isPending) {
    return <LoadingIndicator mini />;
  }
  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <Grid columns="max-content max-content" gap="sm 3xl" padding="md xl">
      <Text bold>{t('Category')}</Text>
      <Text bold align="right">
        {t('Accepted')}
      </Text>
      {data.categories.map(category => (
        <Fragment key={category.name}>
          <Text>{category.name}</Text>
          <Text align="right" tabular>
            {category.accepted.toLocaleString(undefined, {maximumFractionDigits: 2})}
            {category.unit ? ` ${category.unit}` : null}
          </Text>
        </Fragment>
      ))}
    </Grid>
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
          {paymentsPageLinks && <Pagination pageLinks={paymentsPageLinks} />}
        </Fragment>
      ) : (
        <ContactBillingMembers />
      )}
    </SubscriptionPageContainer>
  );
}

const COLUMNS: TableColumnConfig[] = [
  {key: 'expand', width: 'min-content'},
  {key: 'date', width: 'minmax(min-content, 1fr)'},
  {key: 'amount', width: 'minmax(max-content, 1fr)'},
  {
    key: 'status',
    width: {zero: 'minmax(112px, max-content)', sm: 'minmax(max-content, 1fr)'},
  },
  {key: 'receiptId', width: 'minmax(0, 1fr)', visible: {sm: true}},
  {key: 'download', width: {zero: 'max-content', xl: 'minmax(max-content, 2fr)'}},
];

function ReceiptTable({
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
}) {
  const isSmallContainer = useResponsivePropValue({zero: true, xl: false});

  return (
    <SimpleTable
      aria-label={t('Receipts')}
      columns={COLUMNS}
      data-test-id="payment-list"
      scrollable
      header={
        <SimpleTable.HeaderRow>
          <SimpleTable.HeaderCell />
          <SimpleTable.HeaderCell>{t('Date')}</SimpleTable.HeaderCell>
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
            payment={payment}
            organization={organization}
            isSmallContainer={isSmallContainer}
          />
        ))
      ) : (
        <SimpleTable.Empty>{t('No receipts found')}</SimpleTable.Empty>
      )}
    </SimpleTable>
  );
}

function ReceiptRow({
  isSmallContainer,
  organization,
  payment,
}: {
  isSmallContainer: boolean;
  organization: Organization;
  payment: InvoiceBase;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasUsage =
    organization.features.includes('invoice-usage-downloads') && !!payment.usageCsvLinks;

  return (
    <Fragment>
      <SimpleTable.Row>
        <SimpleTable.RowCell paddingRight="0">
          {hasUsage && (
            <Button
              size="xs"
              variant="transparent"
              icon={<IconChevron direction={isExpanded ? 'down' : 'right'} />}
              aria-label={isExpanded ? t('Hide usage') : t('Show usage')}
              aria-expanded={isExpanded}
              onClick={() => setIsExpanded(!isExpanded)}
            />
          )}
        </SimpleTable.RowCell>
        <SimpleTable.RowCell>
          <Link to={`/settings/${organization.slug}/billing/receipts/${payment.id}/`}>
            {moment(payment.dateCreated).format('MMM D, YYYY')}
          </Link>
        </SimpleTable.RowCell>
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
            {hasUsage && payment.usageCsvLinks && (
              <UsageCsvDownloads
                links={payment.usageCsvLinks}
                iconOnly={isSmallContainer}
              />
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
        <SimpleTable.FullWidthRow>
          <ReceiptUsageBreakdown invoiceId={payment.id} />
        </SimpleTable.FullWidthRow>
      )}
    </Fragment>
  );
}

export default PaymentHistory;
