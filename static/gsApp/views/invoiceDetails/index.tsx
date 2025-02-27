import {Fragment} from 'react';
import styled from '@emotion/styled';

import {DateTime} from 'sentry/components/dateTime';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {IconSentry} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {keepPreviousData, useApiQuery} from 'sentry/utils/queryClient';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import type {BillingDetails, Invoice} from 'getsentry/types';
import {InvoiceItemType, InvoiceStatus} from 'getsentry/types';
import {getTaxFieldInfo} from 'getsentry/utils/salesTax';

import {displayPriceWithCents} from '../amCheckout/utils';

import InvoiceDetailsActions from './actions';

type Props = RouteComponentProps<{invoiceGuid: string}, unknown> & {
  organization: Organization;
};

function InvoiceDetails({organization, params}: Props) {
  const {
    data: billingDetails,
    isPending: isBillingDetailsLoading,
    isError: isBillingDetailsError,
    refetch: billingDetailsRefetch,
  } = useApiQuery<BillingDetails>([`/customers/${organization.slug}/billing-details/`], {
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
  const {
    data: invoice,
    isPending: isInvoiceLoading,
    isError: isInvoiceError,
    refetch: invoiceRefetch,
  } = useApiQuery<Invoice>(
    [`/customers/${organization.slug}/invoices/${params.invoiceGuid}/`],
    {staleTime: Infinity}
  );

  if (isBillingDetailsError || isInvoiceError) {
    return (
      <LoadingError
        onRetry={() => {
          billingDetailsRefetch();
          invoiceRefetch();
        }}
      />
    );
  }

  return (
    <Fragment>
      <SettingsPageHeader title={t('Invoice Details')}>
        {t('Invoice Details')}
      </SettingsPageHeader>
      <Panel>
        {isInvoiceLoading || isBillingDetailsLoading ? (
          <PanelBody withPadding>
            <LoadingIndicator />
          </PanelBody>
        ) : (
          <PanelBody withPadding>
            <SenderContainer>
              <div>
                <SenderName>
                  <IconSentry size="lg" /> {invoice.sender.name}
                </SenderName>
                <StyledAddress>
                  {invoice.sender.address.map((line, idx) => (
                    <div key={idx}>{line}</div>
                  ))}
                </StyledAddress>
                {invoice.sentryTaxIds && (
                  <div>
                    {invoice.sentryTaxIds.taxIdName}: {invoice.sentryTaxIds.taxId}
                  </div>
                )}
                {invoice.sentryTaxIds?.region && (
                  <div>
                    {invoice.sentryTaxIds.region.taxIdName}:{' '}
                    {invoice.sentryTaxIds.region.taxId}
                  </div>
                )}
              </div>
              {invoice && (
                <InvoiceDetailsActions
                  organization={organization}
                  invoice={invoice}
                  reloadInvoice={invoiceRefetch}
                />
              )}
            </SenderContainer>
            <hr />
            <InvoiceDetailsContents invoice={invoice} billingDetails={billingDetails} />
          </PanelBody>
        )}
      </Panel>
    </Fragment>
  );
}

type AttributeProps = {
  invoice: Invoice;
  billingDetails?: BillingDetails;
};

function InvoiceAttributes({invoice, billingDetails}: AttributeProps) {
  let paymentStatus: InvoiceStatus = InvoiceStatus.CLOSED;

  if (invoice.isPaid) {
    paymentStatus = InvoiceStatus.PAID;
  } else if (!invoice.isClosed) {
    paymentStatus = InvoiceStatus.AWAITING_PAYMENT;
  }

  const contactInfo = invoice?.displayAddress || billingDetails?.displayAddress;
  const companyName = billingDetails?.companyName;
  const billingEmail = billingDetails?.billingEmail;
  const taxNumber = invoice?.taxNumber || billingDetails?.taxNumber;
  const countryCode = invoice?.countryCode || billingDetails?.countryCode;
  const taxNumberName = `${getTaxFieldInfo(countryCode).label}:`;

  return (
    <AttributeGroup>
      <Attributes>
        <dt>{t('Account:')}</dt>
        <dd>
          {invoice.customer?.name && <div>{invoice.customer.name}</div>}
          {billingEmail}
        </dd>
        {companyName || contactInfo ? (
          <Fragment>
            <dt>{t('Details:')}</dt>
            <dd>
              {!!companyName && <div>{companyName}</div>}
              {!!contactInfo && <div>{contactInfo}</div>}
            </dd>
          </Fragment>
        ) : null}
        {!!taxNumber && (
          <Fragment>
            <dt>{taxNumberName}</dt>
            <dd>{taxNumber}</dd>
          </Fragment>
        )}
      </Attributes>
      <Attributes>
        <dt>{t('Invoice ID:')}</dt>
        <dd>{invoice.id}</dd>
        <dt>{t('Status:')}</dt>
        <dd>{paymentStatus.toUpperCase()}</dd>
        <dt>{t('Date:')}</dt>
        <dd>
          <DateTime date={invoice.dateCreated} dateOnly year />
        </dd>
      </Attributes>
    </AttributeGroup>
  );
}

type ContentsProps = {
  invoice: Invoice;
  billingDetails?: BillingDetails;
};

function InvoiceDetailsContents({billingDetails, invoice}: ContentsProps) {
  // If an Invoice has 'isReverseCharge: true', it should be noted in
  // the last row of the table with "VAT" in the left column and "Reverse Charge"
  // on the right underneath the totals and (if included) refunds
  return (
    <Fragment>
      <InvoiceAttributes invoice={invoice} billingDetails={billingDetails} />

      <InvoiceItems data-test-id="invoice-items">
        <colgroup>
          <col />
          <col style={{width: '150px'}} />
        </colgroup>
        <thead>
          <tr>
            <th>{t('Item')}</th>
            <th>{t('Price')}</th>
          </tr>
        </thead>
        <tfoot>
          <tr>
            <th>{t('Total')}</th>
            <td>{displayPriceWithCents({cents: invoice.amountBilled ?? 0})} USD</td>
          </tr>
          {invoice.isRefunded && (
            <RefundRow>
              <th>{t('Refunds')}</th>
              <td>{displayPriceWithCents({cents: invoice.amountRefunded})} USD</td>
            </RefundRow>
          )}
          {invoice.isReverseCharge && (
            <tr>
              <th>{invoice.defaultTaxName}</th>
              <td>{t('Reverse Charge')}</td>
            </tr>
          )}
        </tfoot>
        <tbody>
          {invoice.items.map((item, i) => {
            if (item.type === InvoiceItemType.SUBSCRIPTION) {
              return (
                <tr key={i}>
                  <td>
                    {tct('[description] Plan', {description: item.description})}
                    <small>
                      {tct('[start] to [end]', {
                        start: <DateTime date={item.periodStart} dateOnly year />,
                        end: <DateTime date={item.periodEnd} dateOnly year />,
                      })}
                    </small>
                  </td>
                  <td>{displayPriceWithCents({cents: item.amount})} USD</td>
                </tr>
              );
            }
            return (
              <tr key={i}>
                <td>{item.description}</td>
                <td>{displayPriceWithCents({cents: item.amount})} USD</td>
              </tr>
            );
          })}
        </tbody>
      </InvoiceItems>
    </Fragment>
  );
}

export default withOrganization(InvoiceDetails);

const SenderName = styled('h3')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const SenderContainer = styled('div')`
  display: grid;
  grid-template-columns: auto auto;
  gap: ${space(2)};

  padding-left: ${space(1)};

  /* Use a vertical layout on smaller viewports */
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: auto;
    grid-template-rows: auto auto;
  }
`;

const AttributeGroup = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(2)};

  /* Use a vertical layout on smaller viewports */
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: auto;
    grid-template-rows: auto auto;
  }
`;

const Attributes = styled('dl')`
  overflow: hidden;

  dt {
    font-weight: bold;
    margin: 0 0 ${space(0.25)} ${space(1)};
  }
  dd {
    background: ${p => p.theme.backgroundSecondary};
    padding: ${space(1)};
    margin-bottom: ${space(2)};
  }
`;

const StyledAddress = styled('address')`
  margin-bottom: 0px;
  line-height: 1.5;
  font-style: normal;
`;

const InvoiceItems = styled('table')`
  width: 100%;

  tr th,
  tr td {
    border-top: 1px solid ${p => p.theme.innerBorder};
    padding: ${space(2)} ${space(1)};
  }
  thead tr:first-child th,
  thead tr:first-child td {
    border-top: none;
  }

  th:last-child,
  td:last-child {
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  td small {
    display: block;
    margin-top: ${space(0.5)};
  }
`;

const RefundRow = styled('tr')`
  td,
  th {
    background: ${p => p.theme.alert.warning.backgroundLight};
  }
`;
