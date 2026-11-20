import {Fragment} from 'react';
import {useQueryState} from 'nuqs';

import {Stack} from '@sentry/scraps/layout';
import type {ModalRenderProps} from '@sentry/scraps/modal';
import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

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
            referrer={referrer || undefined}
            buttonText={t('Pay Now')}
          />
        </Stack>
      </Body>
    </Fragment>
  );
}
