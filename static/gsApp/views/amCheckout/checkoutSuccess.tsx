import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import LogoSentry from 'sentry/components/logoSentry';
import {t, tct} from 'sentry/locale';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import {InvoiceItemType, type Invoice} from 'getsentry/types';
import * as utils from 'getsentry/views/amCheckout/utils';

function Receipt({invoice}: {invoice: Invoice}) {
  const planItem = invoice.items.find(item => item.type === InvoiceItemType.SUBSCRIPTION);
  const products = invoice.items.filter(
    item => item.type === InvoiceItemType.RESERVED_SEER_BUDGET
  );
  const successfulCharge = invoice.charges.find(charge => charge.isPaid);

  return (
    <div>
      <ReceiptSlot />
      <ReceiptPaper>
        <LogoSentry />
        <ReceiptDate>
          --------- {moment(invoice.dateCreated).format('MMM D YYYY hh:mm')} ---------
        </ReceiptDate>
        {planItem && (
          <ReceiptSection>
            <ReceiptItem>
              <div>
                {tct('[planName] Plan', {
                  planName: planItem.description.replace('Subscription to ', ''),
                })}
              </div>
              <div>{utils.displayPrice({cents: planItem.amount})}</div>
            </ReceiptItem>
            {invoice.items
              .filter(
                item =>
                  item.type.startsWith('reserved_') &&
                  !item.type.startsWith('reserved_seer_')
              )
              .map(item => {
                return (
                  <ReceiptSubItem key={item.type}>
                    <div>
                      {toTitleCase(item.description.replace('reserved ', ''), {
                        allowInnerUpperCase: true,
                      })}
                    </div>
                    <div>{utils.displayPrice({cents: item.amount})}</div>
                  </ReceiptSubItem>
                );
              })}
          </ReceiptSection>
        )}
        {products.length > 0 && (
          <ReceiptSection>
            {products.map(item => {
              return (
                <ReceiptItem key={item.type}>
                  <div>{item.description}</div>
                  <div>{utils.displayPrice({cents: item.amount})}</div>
                </ReceiptItem>
              );
            })}
          </ReceiptSection>
        )}

        <ReceiptSection>
          <Total>
            <div>{t('Total')}</div>
            <div>
              {utils.displayPrice({
                cents:
                  invoice.amountBilled === null ? invoice.amount : invoice.amountBilled,
              })}
            </div>
          </Total>
        </ReceiptSection>
        <ReceiptSection>
          <div>{t('Payment')}</div>
          <div>**** {successfulCharge?.cardLast4}</div>
        </ReceiptSection>
      </ReceiptPaper>
    </div>
  );
}

function CheckoutSuccess({
  invoice,
  nextQueryParams,
}: {
  invoice: Invoice | undefined;
  nextQueryParams: string[];
}) {
  const viewSubscriptionQueryParams =
    nextQueryParams.length > 0 ? `?${nextQueryParams.join('&')}` : '';

  const renewalDate = invoice
    ? moment(
        invoice.items.find(item => item.type === InvoiceItemType.SUBSCRIPTION)?.periodEnd
      )
        .add(1, 'day')
        .format('MMM D, YYYY')
    : undefined;

  return (
    <Content>
      <div>
        <Title>{t('Pleasure doing business with you')}</Title>
        <Description>
          {invoice
            ? tct(
                'We’ve processed your payment and updated your subscription. Your plan will renew on [date].',
                {date: renewalDate}
              )
            : t("You'll see your changes soon!")}
        </Description>
        <ButtonContainer>
          <LinkButton
            aria-label={t('Edit plan')}
            to="/settings/billing/checkout/?referrer=checkout_success"
          >
            {t('Edit plan')}
          </LinkButton>
          <LinkButton
            priority="primary"
            aria-label={t('View your subscription')}
            to={`/settings/billing/${viewSubscriptionQueryParams}`}
          >
            {t('View your subscription')}
          </LinkButton>
        </ButtonContainer>
      </div>
      {invoice && <Receipt invoice={invoice} />}
    </Content>
  );
}

export default CheckoutSuccess;

const Content = styled('div')`
  padding: ${p => p.theme.space['2xl']};
  max-width: ${p => p.theme.breakpoints.xl};
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 100px;
  margin: auto 200px;
`;

const Title = styled('h1')`
  font-size: ${p => p.theme.fontSize['2xl']};
  margin: 0;
`;

const Description = styled('p')`
  font-size: ${p => p.theme.fontSize.lg};
  margin: 0;
  color: ${p => p.theme.subText};
`;

const ButtonContainer = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.sm};
  margin-top: ${p => p.theme.space['2xl']};
`;

const ReceiptSlot = styled('div')`
  width: 445px;
  height: 7px;
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.gray200};
  box-shadow: 0px 2px 4px 0px #00000008 inset;
`;

const ReceiptPaper = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  position: relative;
  z-index: 1000;
  width: 320px;
  left: 62px;
  top: -7px;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${p => p.theme.space.xl};
  padding: ${p => p.theme.space.xl};
`;

const ReceiptDate = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.gray500};
  font-family: ${p => p.theme.text.familyMono};
`;

const ReceiptSection = styled('div')`
  border-bottom: 1px dashed ${p => p.theme.border};
  padding-bottom: ${p => p.theme.space.xl};
  width: 100%;
`;

const ReceiptItem = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  display: flex;
  justify-content: space-between;
`;

const ReceiptSubItem = styled(ReceiptItem)`
  padding-left: ${p => p.theme.space.md};
`;

const Total = styled(ReceiptItem)`
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.xl};
`;
