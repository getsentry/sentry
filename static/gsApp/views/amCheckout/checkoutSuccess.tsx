import styled from '@emotion/styled';
import Color from 'color';
import moment from 'moment-timezone';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import LogoSentry from 'sentry/components/logoSentry';
import {t, tct} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';
import {defined} from 'sentry/utils';

import {GIGABYTE} from 'getsentry/constants';
import {InvoiceItemType, type Invoice, type Plan} from 'getsentry/types';
import {formatReservedWithUnits} from 'getsentry/utils/billing';
import {
  getPlanCategoryName,
  getSingularCategoryName,
  isByteCategory,
} from 'getsentry/utils/dataCategory';
import * as utils from 'getsentry/views/amCheckout/utils';

function Receipt({invoice, basePlan}: {basePlan: Plan | undefined; invoice: Invoice}) {
  const planItem = invoice.items.find(item => item.type === InvoiceItemType.SUBSCRIPTION);
  const renewalDate = moment(planItem?.periodEnd).add(1, 'day').format('MMM DD YYYY');
  const products = invoice.items.filter(
    item => item.type === InvoiceItemType.RESERVED_SEER_BUDGET
  );
  const successfulCharge = invoice.charges.find(charge => charge.isPaid);

  return (
    <div>
      <ReceiptSlot />
      <ReceiptPaper>
        <ReceiptContent>
          <LogoSentry />
          <ReceiptDate>
            <DateSeparator />
            {moment(invoice.dateCreated).format('MMM D YYYY hh:mm')} <DateSeparator />
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
              {basePlan &&
                Object.entries(basePlan.planCategories).map(([category, buckets]) => {
                  const baseReserved = buckets[0]?.events ?? 0;
                  if (baseReserved <= 0) {
                    return null;
                  }
                  const formattedReserved = formatReservedWithUnits(
                    baseReserved,
                    category as DataCategory,
                    {
                      isAbbreviated: true,
                      useUnitScaling: true,
                    }
                  );
                  const formattedCategory =
                    baseReserved === 1 && !isByteCategory(category)
                      ? getSingularCategoryName({
                          plan: basePlan,
                          category: category as DataCategory,
                          title: true,
                        })
                      : getPlanCategoryName({
                          plan: basePlan,
                          category: category as DataCategory,
                          title: true,
                        });
                  return (
                    <ReceiptSubItem key={category}>
                      <div>{formattedReserved}</div>
                      <div>{formattedCategory}</div>
                      <div />
                    </ReceiptSubItem>
                  );
                })}
              {invoice.items
                .filter(
                  item =>
                    item.type.startsWith('reserved_') &&
                    !item.type.endsWith('_budget') &&
                    item.amount > 0
                )
                .map(item => {
                  const category = utils.invoiceItemTypeToDataCategory(item.type);
                  if (!defined(category)) {
                    return null;
                  }
                  const reserved = isByteCategory(category)
                    ? item.data.quantity / GIGABYTE
                    : (item.data.quantity ?? 0);
                  if (reserved <= 0) {
                    return null;
                  }
                  const formattedReserved = formatReservedWithUnits(reserved, category, {
                    isAbbreviated: true,
                    useUnitScaling: true,
                  });
                  const formattedCategory = getPlanCategoryName({
                    plan: basePlan,
                    category,
                    title: true,
                  });
                  return (
                    <ReceiptSubItem key={item.type}>
                      <div>+{formattedReserved}</div>
                      <div>{formattedCategory}</div>
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
          {(successfulCharge || renewalDate) && (
            <ReceiptSection>
              {successfulCharge && (
                <ReceiptItem>
                  <div>{t('Payment')}</div>
                  <div>**** {successfulCharge.cardLast4}</div>
                </ReceiptItem>
              )}
              {renewalDate && (
                <ReceiptItem>
                  <div>{t('Plan Renews')}</div>
                  <div>{renewalDate}</div>
                </ReceiptItem>
              )}
            </ReceiptSection>
          )}
        </ReceiptContent>
        <ZigZagEdge />
      </ReceiptPaper>
    </div>
  );
}

function CheckoutSuccess({
  invoice,
  basePlan,
  nextQueryParams,
}: {
  basePlan: Plan | undefined;
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
      <InnerContent>
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
            {/* TODO(ISABELLA): FIX THIS TO REMOVE INVOICE FROM STATE */}
          </LinkButton>
          <LinkButton
            priority="primary"
            aria-label={t('View your subscription')}
            to={`/settings/billing/${viewSubscriptionQueryParams}`}
          >
            {t('View your subscription')}
          </LinkButton>
        </ButtonContainer>
      </InnerContent>
      {invoice && <Receipt invoice={invoice} basePlan={basePlan} />}
    </Content>
  );
}

export default CheckoutSuccess;

const Content = styled('div')`
  padding: ${p => p.theme.space['2xl']};
  max-width: ${p => p.theme.breakpoints.xl};
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin: auto 100px;

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    flex-direction: column;
    gap: ${p => p.theme.space['3xl']};
    margin: ${p => p.theme.space['3xl']};
  }
`;

const InnerContent = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  max-width: 500px;
  text-align: left;

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    align-items: center;
    text-align: center;
  }
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

const ReceiptContent = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${p => p.theme.space.xl};
  padding: ${p => p.theme.space.xl};
`;

const ReceiptPaper = styled('div')`
  position: relative;
  z-index: 1000;
  left: 62px;
  top: -7px;
  width: 320px;
  border: 1px solid ${p => p.theme.border};
  border-top: none;
  border-bottom: none;
  box-shadow: inset 0 10px 6px -6px
    ${p => Color(p.theme.black).lighten(0.05).alpha(0.15).toString()};
  background: ${p => p.theme.background};
`;

const ReceiptDate = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.gray500};
  font-family: ${p => p.theme.text.familyMono};
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  gap: ${p => p.theme.space.sm};
  align-items: center;
`;

const ReceiptSection = styled('div')`
  border-bottom: 1px dashed ${p => p.theme.border};
  padding-bottom: ${p => p.theme.space.xl};
  width: 100%;
`;

const ReceiptItem = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  display: grid;
  grid-template-columns: repeat(2, 1fr);

  & > :last-child {
    justify-self: end;
  }
`;

const ReceiptSubItem = styled(ReceiptItem)`
  padding-left: ${p => p.theme.space.md};
  grid-template-columns: 1fr 2fr 1fr;
  gap: ${p => p.theme.space.lg};
`;

const Total = styled(ReceiptItem)`
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.xl};
`;

const ZigZagEdge = styled('div')`
  --a: 90deg; /* control the angle */
  --s: 10px; /* size of the zig-zag */
  --b: 2px; /* control the thickness */

  background: ${p => p.theme.border};
  height: calc(var(--b) + var(--s) / (2 * tan(var(--a) / 2)));
  --_g: var(--s) repeat-x
    conic-gradient(
      from calc(var(--a) / -2) at bottom,
      #0000,
      #000 1deg calc(var(--a) - 1deg),
      #0000 var(--a)
    );
  mask:
    50% calc(-1 * var(--b)) / var(--_g) exclude,
    50% / var(--_g);
`;

const DateSeparator = styled('div')`
  border-top: 1px dashed ${p => p.theme.gray500};
  width: 100%;
`;
