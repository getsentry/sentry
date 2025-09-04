import styled from '@emotion/styled';
import Color from 'color';
import {motion} from 'framer-motion';
import moment from 'moment-timezone';

import Barcode from 'sentry-images/checkout/barcode.png';
import SentryLogo from 'sentry-images/checkout/sentry-receipt-logo.png';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {t, tct} from 'sentry/locale';
import {defined} from 'sentry/utils';

import {GIGABYTE} from 'getsentry/constants';
import {
  InvoiceItemType,
  type Charge,
  type Invoice,
  type InvoiceItem,
  type Plan,
  type PreviewData,
  type PreviewInvoiceItem,
} from 'getsentry/types';
import {
  formatReservedWithUnits,
  getPlanIcon,
  getProductIcon,
} from 'getsentry/utils/billing';
import {
  getPlanCategoryName,
  getSingularCategoryName,
  isByteCategory,
} from 'getsentry/utils/dataCategory';
import * as utils from 'getsentry/views/amCheckout/utils';

export interface CheckoutSuccessProps {
  nextQueryParams: string[];
  basePlan?: Plan;
  invoice?: Invoice;
  previewData?: PreviewData;
}

export interface ChangesProps {
  creditApplied: number;
  fees: Array<InvoiceItem | PreviewInvoiceItem>;
  products: Array<InvoiceItem | PreviewInvoiceItem>;
  reservedVolume: Array<InvoiceItem | PreviewInvoiceItem>;
  total: number;
  plan?: Plan;
  planItem?: InvoiceItem | PreviewInvoiceItem;
}

export interface ScheduledChangesProps extends ChangesProps {
  effectiveDate: string;
}

export interface ReceiptProps extends ChangesProps {
  charges: Charge[];
  dateCreated: string;
  planItem: InvoiceItem;
}

function ScheduledChanges({
  plan,
  creditApplied,
  fees,
  planItem,
  products,
  reservedVolume,
  effectiveDate,
  total,
}: ScheduledChangesProps) {
  const shortInterval = plan ? utils.getShortInterval(plan.contractInterval) : undefined;
  return (
    <ScheduledChangesContainer>
      <EffectiveDate>
        {tct('From [effectiveDate]', {
          effectiveDate,
        })}
      </EffectiveDate>
      {(planItem || reservedVolume.length > 0) && (
        <Flex direction="column" gap="xs">
          {planItem && (
            <div>
              <ScheduledChangesItem>
                <ChangeWithIcon>
                  {plan && getPlanIcon(plan)}
                  <strong>
                    {tct('[planName] Plan', {
                      planName: plan?.name ?? planItem.description,
                    })}
                  </strong>
                </ChangeWithIcon>
                <div>
                  {utils.displayPrice({cents: planItem.amount})}
                  {shortInterval && `/${shortInterval}`}
                </div>
              </ScheduledChangesItem>
            </div>
          )}
          {reservedVolume.map(item => {
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
            const formattedCategory =
              reserved === 1
                ? getSingularCategoryName({
                    plan,
                    category,
                    capitalize: false,
                  })
                : getPlanCategoryName({
                    plan,
                    category,
                    capitalize: false,
                  });
            return (
              <ScheduledChangesSubItem key={item.type}>
                <div>
                  {formattedReserved} {formattedCategory}
                </div>
                {item.amount > 0 ? (
                  <div>
                    {utils.displayPrice({cents: item.amount})}
                    {shortInterval && `/${shortInterval}`}
                  </div>
                ) : (
                  <div />
                )}
              </ScheduledChangesSubItem>
            );
          })}
        </Flex>
      )}
      {products.map(item => {
        const selectableProduct = utils.invoiceItemTypeToProduct(item.type);
        if (!selectableProduct) {
          return null;
        }

        return (
          <ScheduledChangesItem key={item.type}>
            <ChangeWithIcon>
              {getProductIcon(selectableProduct)}
              <div>{item.description}</div>
            </ChangeWithIcon>
            <div>
              {utils.displayPrice({cents: item.amount})}
              {shortInterval && `/${shortInterval}`}
            </div>
          </ScheduledChangesItem>
        );
      })}
      {fees.map(item => {
        const adjustedAmount =
          item.type === InvoiceItemType.BALANCE_CHANGE ? item.amount * -1 : item.amount;
        return (
          <ScheduledChangesItem key={item.type}>
            <div>{item.description}</div>
            <div>{utils.displayPrice({cents: adjustedAmount})}</div>
          </ScheduledChangesItem>
        );
      })}
      {creditApplied && (
        <ScheduledChangesItem>
          <div>{t('Credit applied')}</div>
          <div>{utils.displayPrice({cents: creditApplied})}</div>
        </ScheduledChangesItem>
      )}
      <Separator />
      <Flex align="center" justify="between">
        <strong>{t('Total')}</strong>
        <div>
          <ScheduledChangesPrice>
            {utils.displayPrice({
              cents: total,
            })}
          </ScheduledChangesPrice>
          <Currency>{' USD'}</Currency>
        </div>
      </Flex>
    </ScheduledChangesContainer>
  );
}

function Receipt({
  charges,
  creditApplied,
  fees,
  products,
  reservedVolume,
  total,
  plan,
  planItem,
  dateCreated,
}: ReceiptProps) {
  const renewalDate = moment(planItem?.periodEnd).add(1, 'day').format('MMM DD YYYY');
  // TODO(checkout v3): This needs to be updated for non-budget products
  const successfulCharge = charges.find(charge => charge.isPaid);

  return (
    <div>
      <ReceiptSlot />
      <ReceiptPaperContainer>
        <ReceiptPaperShadow />
        <motion.div
          animate={{y: [-600, -575, -400, -380, -360, -340, -7]}}
          transition={{
            duration: 6,
            type: 'tween',
            times: [0.1, 0.2, 0.3, 0.34, 0.36, 0.37, 1],
          }}
        >
          <ReceiptPaper>
            <ReceiptContent>
              <img src={SentryLogo} alt={t('Sentry logo')} />
              <ReceiptDate>
                <DateSeparator />
                {moment(dateCreated).format('MMM D YYYY hh:mm')} <DateSeparator />
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
                  {reservedVolume.map(item => {
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
                    const formattedReserved = formatReservedWithUnits(
                      reserved,
                      category,
                      {
                        isAbbreviated: true,
                        useUnitScaling: true,
                      }
                    );
                    const formattedCategory =
                      reserved === 1
                        ? getSingularCategoryName({
                            plan,
                            category,
                            title: true,
                          })
                        : getPlanCategoryName({
                            plan,
                            category,
                            title: true,
                          });
                    return (
                      <ReceiptSubItem key={item.type}>
                        <div>{formattedReserved}</div>
                        <div>{formattedCategory}</div>
                        {item.amount > 0 ? (
                          <div>{utils.displayPrice({cents: item.amount})}</div>
                        ) : (
                          <div />
                        )}
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
              {(creditApplied || fees.length > 0) && (
                <ReceiptSection>
                  {fees.map(item => {
                    return (
                      <ReceiptItem key={item.type}>
                        <div>{item.description}</div>
                        <div>{utils.displayPrice({cents: item.amount})}</div>
                      </ReceiptItem>
                    );
                  })}
                  {creditApplied && (
                    <ReceiptItem>
                      <div>{t('Credit applied')}</div>
                      <div>{utils.displayPrice({cents: creditApplied})}</div>
                    </ReceiptItem>
                  )}
                </ReceiptSection>
              )}
              <ReceiptSection>
                <Total>
                  <div>{t('Total')}</div>
                  <div>
                    {utils.displayPrice({
                      cents: total,
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
              <img src={Barcode} alt={t('Barcode')} />
            </ReceiptContent>
            <ZigZagEdge />
          </ReceiptPaper>
        </motion.div>
      </ReceiptPaperContainer>
    </div>
  );
}

function CheckoutSuccess({
  invoice,
  basePlan,
  nextQueryParams,
  previewData,
}: CheckoutSuccessProps) {
  const viewSubscriptionQueryParams =
    nextQueryParams.length > 0 ? `?${nextQueryParams.join('&')}` : '';

  const renewalDate = invoice
    ? moment(
        invoice.items.find(item => item.type === InvoiceItemType.SUBSCRIPTION)?.periodEnd
      )
        .add(1, 'day')
        .format('MMMM D, YYYY')
    : undefined;
  const effectiveDate = previewData
    ? moment(previewData.effectiveAt).add(1, 'day').format('MMMM D, YYYY')
    : undefined;
  const isImmediateCharge = !!invoice; // if they paid for something now, the changes are effective immediately

  // if the customer completed checkout without any scheduled changes or a new invoice, the changes
  // are effective immediately but without an immediate charge
  const effectiveToday =
    isImmediateCharge || effectiveDate === moment().add(1, 'day').format('MMMM D, YYYY');

  const contentTitle = isImmediateCharge
    ? t('Pleasure doing business with you')
    : effectiveToday
      ? t('Consider it done')
      : t('Consider it done (soon)');
  const contentDescription = isImmediateCharge
    ? tct(
        "We've processed your payment and updated your subscription. Your plan will renew on [date].",
        {date: renewalDate}
      )
    : effectiveToday
      ? t("We've updated your subscription.")
      : tct('No charges today. Your subscription will update on [date].', {
          date: effectiveDate,
        });

  const data = isImmediateCharge ? invoice : previewData;
  const invoiceItems = isImmediateCharge
    ? invoice.items
    : (previewData?.invoiceItems ?? []);
  const planItem = invoiceItems.find(item => item.type === InvoiceItemType.SUBSCRIPTION);
  const reservedVolume = invoiceItems.filter(
    item => item.type.startsWith('reserved_') && !item.type.endsWith('_budget')
  );
  // TODO(checkout v3): This needs to be updated for non-budget products
  const products = invoiceItems.filter(
    item => item.type === InvoiceItemType.RESERVED_SEER_BUDGET
  );
  const fees = utils.getFees({invoiceItems});
  const creditApplied = data?.creditApplied ?? 0;
  const total = isImmediateCharge
    ? (invoice.amountBilled ?? invoice.amount)
    : (previewData?.billedAmount ?? 0);

  const commonChangesProps = {
    plan: basePlan,
    planItem,
    reservedVolume,
    products,
    fees,
    creditApplied,
    total,
  };

  return (
    <Content>
      <InnerContent>
        <Title>{contentTitle}</Title>
        <Description>{contentDescription}</Description>
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
            to={`/settings/billing/overview/${viewSubscriptionQueryParams}`}
          >
            {t('View your subscription')}
          </LinkButton>
        </ButtonContainer>
      </InnerContent>
      {isImmediateCharge ? (
        <Receipt
          {...commonChangesProps}
          charges={invoice.charges}
          planItem={planItem as InvoiceItem}
          dateCreated={invoice.dateCreated}
        />
      ) : effectiveToday ? null : (
        previewData &&
        effectiveDate && (
          <ScheduledChanges {...commonChangesProps} effectiveDate={effectiveDate} />
        )
      )}
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
  gap: ${p => p.theme.space['3xl']};

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

const ScheduledChangesContainer = styled('div')`
  display: flex;
  flex-direction: column;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  max-width: 445px;
  padding: ${p => p.theme.space.xl} 0;
  gap: ${p => p.theme.space.xl};

  & > * {
    padding: 0 ${p => p.theme.space.xl};
  }
`;

const ScheduledChangesItem = styled('div')`
  display: grid;
  align-items: center;
  grid-template-columns: repeat(2, 1fr);

  & > :last-child {
    justify-self: end;
  }
`;

const ScheduledChangesSubItem = styled(ScheduledChangesItem)`
  padding-left: ${p => p.theme.space.xl};
`;

const EffectiveDate = styled('h2')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.lg};
`;

const Separator = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  padding: 0;
`;

const ScheduledChangesPrice = styled('span')`
  font-size: ${p => p.theme.fontSize['2xl']};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const Currency = styled('span')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const ChangeWithIcon = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const ReceiptSlot = styled('div')`
  width: 445px;
  height: 7px;
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.gray200};
  box-shadow: 0px 2px 4px 0px
    ${p => Color(p.theme.black).lighten(0.08).alpha(0.15).toString()} inset;
`;

const ReceiptContent = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${p => p.theme.space.xl};
  padding: ${p => p.theme.space.xl};
`;

const ReceiptPaperContainer = styled('div')`
  position: relative;
  left: 62px;
  top: -7px;
  width: 320px;
  overflow: hidden;
`;

const ReceiptPaperShadow = styled('div')`
  position: relative;
  z-index: 1000;
  top: 0;
  width: 320px;
  height: 7px;
  box-shadow: inset 0 10px 6px -6px
    ${p => Color(p.theme.black).lighten(0.05).alpha(0.15).toString()};
`;

const ReceiptPaper = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-top: none;
  border-bottom: none;
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

const DateSeparator = styled('div')`
  border-top: 1px dashed ${p => p.theme.gray500};
  width: 100%;
`;

const ReceiptSection = styled('div')`
  border-bottom: 1px dashed ${p => p.theme.border};
  padding-bottom: ${p => p.theme.space.xl};
  width: 100%;
`;

const ReceiptItem = styled(ScheduledChangesItem)`
  font-family: ${p => p.theme.text.familyMono};
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
