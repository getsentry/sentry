import {Fragment} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';

import CreditCardForm from 'getsentry/components/creditCardEdit/form';
import type {Invoice} from 'getsentry/types';
import {displayPriceWithCents} from 'getsentry/views/amCheckout/utils';

type Props = Pick<ModalRenderProps, 'Header' | 'Body' | 'closeModal'> & {
  invoice: Invoice;
  organization: Organization;
  reloadInvoice: () => void;
};

function InvoiceDetailsPaymentForm({
  Header,
  Body,
  closeModal,
  organization,
  invoice,
  reloadInvoice,
}: Props) {
  const location = useLocation();
  const endpoint = getApiUrl(
    '/organizations/$organizationIdOrSlug/payments/$paymentId/new/',
    {path: {organizationIdOrSlug: invoice.customer.slug, paymentId: invoice.id}}
  );

  return (
    <Fragment>
      <Header>{t('Pay Bill')}</Header>
      <Body>
        <Flex direction="column" gap="sm">
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
            onSuccess={() => {
              reloadInvoice();
              closeModal();
            }}
            organization={organization}
            intentDataEndpoint={endpoint}
            referrer={decodeScalar(location?.query?.referrer)}
            buttonText={t('Pay Now')}
          />
        </Flex>
      </Body>
    </Fragment>
  );
}

export default InvoiceDetailsPaymentForm;
