import {Fragment} from 'react';
import {useQueryState} from 'nuqs';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';

import {CreditCardForm} from 'getsentry/components/creditCardEdit/form';
import type {Invoice} from 'getsentry/types';
import {displayPriceWithCents} from 'getsentry/utils/billing';

type Props = Pick<ModalRenderProps, 'Header' | 'Body' | 'closeModal'> & {
  invoice: Invoice;
  organization: Organization;
  reloadInvoice: () => void;
};

export default function InvoiceDetailsPaymentForm({
  Header,
  Body,
  closeModal,
  organization,
  invoice,
  reloadInvoice,
}: Props) {
  const [referrer] = useQueryState('referrer');
  const endpoint = [
    getApiUrl('/organizations/$organizationIdOrSlug/payments/$paymentId/new/', {
      path: {organizationIdOrSlug: organization.slug, paymentId: invoice.id},
    }),
  ] satisfies ApiQueryKey;

  return (
    <Fragment>
      <Header>{t('Pay Bill')}</Header>
      <Body>
        <Stack gap="sm">
          <Text as="p">
            {tct('Complete payment for [amount] USD', {
              amount: displayPriceWithCents({cents: invoice.amountBilled ?? 0}),
            })}
          </Text>
          <CreditCardForm
            budgetTerm={
              'planDetails' in invoice.customer
                ? invoice.customer.planDetails.budgetTerm
                : t('pay-as-you-go')
            }
            onCancel={() => closeModal()}
            amount={invoice.amountBilled ?? 0}
            cardMode="payment"
            invoiceGuid={invoice.id}
            onSuccess={() => {
              reloadInvoice();
              closeModal();
            }}
            organization={organization}
            intentDataQueryKey={endpoint}
            referrer={referrer || undefined}
            buttonText={t('Pay Now')}
          />
        </Stack>
      </Body>
    </Fragment>
  );
}
