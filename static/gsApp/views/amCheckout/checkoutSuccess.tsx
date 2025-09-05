import type React from 'react';
import styled from '@emotion/styled';
import Color from 'color';
import {motion} from 'framer-motion';
import moment from 'moment-timezone';

import Barcode from 'sentry-images/checkout/barcode.png';
import SentryLogo from 'sentry-images/checkout/sentry-receipt-logo.png';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
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

interface CheckoutSuccessProps {
  nextQueryParams: string[];
  basePlan?: Plan;
  invoice?: Invoice;
  previewData?: PreviewData;
}

interface ChangesProps {
  creditApplied: number;
  credits: Array<InvoiceItem | PreviewInvoiceItem>;
  fees: Array<InvoiceItem | PreviewInvoiceItem>;
  products: Array<InvoiceItem | PreviewInvoiceItem>;
  reservedVolume: Array<InvoiceItem | PreviewInvoiceItem>;
  total: number;
  plan?: Plan;
  planItem?: InvoiceItem | PreviewInvoiceItem;
}

interface ScheduledChangesProps extends ChangesProps {
  effectiveDate: string;
}

interface ReceiptProps extends ChangesProps {
  charges: Charge[];
  dateCreated: string;
  planItem: InvoiceItem;
}

function ScheduledChangeItem({
  firstItem,
  textItems,
}: {
  textItems: Array<React.ReactNode | null>;
  firstItem?: React.ReactNode;
}) {
  return (
    <StyledGrid columns="repeat(2, 1fr)" align="center">
      {firstItem && firstItem}
      {textItems.map((item, index) =>
        item === null ? (
          <div key={index} />
        ) : (
          <Text as="div" key={index}>
            {item}
          </Text>
        )
      )}
    </StyledGrid>
  );
}

function ScheduledChangeSubItem({textItems}: {textItems: Array<React.ReactNode | null>}) {
  return (
    <StyledGrid columns="repeat(2, 1fr)" align="center" paddingLeft="xl">
      {textItems.map((item, index) =>
        item === null ? (
          <div key={index} />
        ) : (
          <Text as="div" key={index}>
            {item}
          </Text>
        )
      )}
    </StyledGrid>
  );
}

function ScheduledChanges({
  plan,
  creditApplied,
  credits,
  fees,
  planItem,
  products,
  reservedVolume,
  effectiveDate,
  total,
}: ScheduledChangesProps) {
  const shortInterval = plan ? utils.getShortInterval(plan.contractInterval) : undefined;
  return (
    <Flex
      data-test-id="scheduled-changes"
      direction="column"
      gap="xl"
      padding="xl"
      maxWidth="445px"
      border="primary"
      radius="md"
    >
      <Heading size="lg" as="h2">
        {tct('From [effectiveDate]', {
          effectiveDate,
        })}
      </Heading>
      {(planItem || reservedVolume.length > 0) && (
        <Flex direction="column" gap="xs">
          {planItem && (
            <ScheduledChangeItem
              firstItem={
                <Flex align="center" gap="sm">
                  {plan && getPlanIcon(plan)}
                  <Text as="span" bold>
                    {tct('[planName] Plan', {
                      planName: plan?.name ?? planItem.description,
                    })}
                  </Text>
                </Flex>
              }
              textItems={[
                `${utils.displayPrice({cents: planItem.amount})}${shortInterval && `/${shortInterval}`}`,
              ]}
            />
          )}
          {reservedVolume.map(item => {
            const category = utils.invoiceItemTypeToDataCategory(item.type);
            if (!defined(category)) {
              return null;
            }
            const quantity = item.data.quantity ?? 0;
            const reserved = isByteCategory(category) ? quantity / GIGABYTE : quantity;
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
              <ScheduledChangeSubItem
                key={item.type}
                textItems={[
                  `${formattedReserved} ${formattedCategory}`,
                  item.amount > 0
                    ? `${utils.displayPrice({cents: item.amount})} ${shortInterval && `/${shortInterval}`}`
                    : null,
                ]}
              />
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
          <ScheduledChangeItem
            key={item.type}
            firstItem={
              <ChangeWithIcon>
                {getProductIcon(selectableProduct)}
                <div>{item.description}</div>
              </ChangeWithIcon>
            }
            textItems={[
              `${utils.displayPrice({cents: item.amount})}${shortInterval && `/${shortInterval}`}`,
            ]}
          />
        );
      })}
      {fees.map(item => {
        const adjustedAmount =
          item.type === InvoiceItemType.BALANCE_CHANGE ? item.amount * -1 : item.amount;
        return (
          <ScheduledChangeItem
            key={item.type}
            textItems={[item.description, utils.displayPrice({cents: adjustedAmount})]}
          />
        );
      })}
      {creditApplied > 0 && (
        <ScheduledChangeItem
          textItems={[t('Credit applied'), utils.displayPrice({cents: creditApplied})]}
        />
      )}
      {credits.map(item => {
        const adjustedAmount =
          item.type === InvoiceItemType.BALANCE_CHANGE ? item.amount * -1 : item.amount;
        return (
          <ScheduledChangeItem
            key={item.type}
            textItems={[item.description, utils.displayPrice({cents: adjustedAmount})]}
          />
        );
      })}
      <Separator />
      <Flex align="center" justify="between">
        <Text as="span" bold>
          {t('Total')}
        </Text>
        <div>
          <Text as="span" size="2xl" bold>
            {utils.displayPrice({
              cents: total,
            })}
          </Text>
          <Text as="span" size="lg">
            {' USD'}
          </Text>
        </div>
      </Flex>
    </Flex>
  );
}

function ReceiptItem({rowItems}: {rowItems: Array<React.ReactNode | null>}) {
  return (
    <StyledGrid columns="repeat(2, 1fr)" align="center">
      {rowItems.map((item, index) =>
        item === null ? (
          <div key={index} /> // empty grid cell
        ) : (
          <Text as="div" monospace key={index}>
            {item}
          </Text>
        )
      )}
    </StyledGrid>
  );
}

function ReceiptSection({children}: {children: React.ReactNode}) {
  return (
    <DashedContainer width="100%" paddingBottom="xl">
      {children}
    </DashedContainer>
  );
}

function Receipt({
  charges,
  creditApplied,
  credits,
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
    <div data-test-id="receipt">
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
          <ReceiptPaper background="primary">
            <Flex direction="column" gap="xl" padding="xl" align="center">
              <img src={SentryLogo} alt={t('Sentry logo')} />
              <Grid columns="1fr 2fr 1fr" align="center" gap="sm">
                <DateSeparator />
                <Text as="span" size="sm" variant="muted" monospace>
                  {moment(dateCreated).format('MMM D YYYY hh:mm')}
                </Text>
                <DateSeparator />
              </Grid>
              {planItem && (
                <ReceiptSection>
                  <ReceiptItem
                    rowItems={[
                      tct('[planName] Plan', {
                        planName: planItem.description.replace('Subscription to ', ''),
                      }),
                      utils.displayPrice({cents: planItem.amount}),
                    ]}
                  />
                  {reservedVolume.map(item => {
                    const category = utils.invoiceItemTypeToDataCategory(item.type);
                    if (!defined(category)) {
                      return null;
                    }
                    const quantity = item.data.quantity ?? 0;
                    const reserved = isByteCategory(category)
                      ? quantity / GIGABYTE
                      : quantity;
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
                      <ReceiptItem
                        key={item.type}
                        rowItems={[
                          formattedReserved,
                          formattedCategory,
                          item.amount > 0
                            ? utils.displayPrice({cents: item.amount})
                            : null,
                        ]}
                      />
                    );
                  })}
                </ReceiptSection>
              )}
              {products.length > 0 && (
                <ReceiptSection>
                  {products.map(item => {
                    return (
                      <ReceiptItem
                        key={item.type}
                        rowItems={[
                          item.description,
                          utils.displayPrice({cents: item.amount}),
                        ]}
                      />
                    );
                  })}
                </ReceiptSection>
              )}
              {(creditApplied > 0 || credits.length + fees.length > 0) && (
                <ReceiptSection>
                  {fees.map(item => {
                    return (
                      <ReceiptItem
                        key={item.type}
                        rowItems={[
                          item.description,
                          utils.displayPrice({cents: item.amount}),
                        ]}
                      />
                    );
                  })}
                  {creditApplied > 0 && (
                    <ReceiptItem
                      rowItems={[
                        t('Credit applied'),
                        utils.displayPrice({cents: creditApplied}),
                      ]}
                    />
                  )}
                  {credits.map(item => {
                    return (
                      <ReceiptItem
                        key={item.type}
                        rowItems={[
                          item.description,
                          utils.displayPrice({cents: item.amount}),
                        ]}
                      />
                    );
                  })}
                </ReceiptSection>
              )}
              <ReceiptSection>
                <ReceiptItem
                  rowItems={[t('Total'), utils.displayPrice({cents: total})]}
                />
              </ReceiptSection>
              {(successfulCharge || renewalDate) && (
                <ReceiptSection>
                  {successfulCharge && (
                    <ReceiptItem
                      rowItems={[t('Payment'), `**** ${successfulCharge.cardLast4}`]}
                    />
                  )}
                  {renewalDate && (
                    <ReceiptItem rowItems={[t('Plan Renews'), renewalDate]} />
                  )}
                </ReceiptSection>
              )}
              <img src={Barcode} alt={t('Barcode')} />
            </Flex>
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
  const credits = utils.getCredits({invoiceItems});
  // TODO(isabella): PreviewData never has the InvoiceItemType.BALANCE_CHANGE type
  // and instead populates creditApplied with the value of the InvoiceItemType.CREDIT_APPLIED type
  // this is a temporary fix to ensure we only display CreditApplied if it's not already in the credits array
  const creditApplied = utils.getCreditApplied({
    creditApplied: data?.creditApplied ?? 0,
    invoiceItems,
  });
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
    credits,
  };

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

  return (
    <Content
      padding="2xl"
      maxWidth="1440px"
      align="center"
      justify="between"
      gap="3xl"
      direction={{sm: 'column', md: 'row'}}
    >
      <Flex direction="column" align={{sm: 'center', md: 'start'}} maxWidth="500px">
        <Title size="2xl" as="h1" align="left">
          {contentTitle}
        </Title>
        <Flex gap="2xl" direction="column" align={{sm: 'center', md: 'start'}}>
          <Description variant="muted" size="lg" align="left">
            {contentDescription}
          </Description>
          <Flex gap="sm">
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
          </Flex>
        </Flex>
      </Flex>
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

// TODO(isabella): move the centering to parent component
const Content = styled(Flex)`
  margin: auto 100px;

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    margin: ${p => p.theme.space['3xl']};
  }
`;

const Title = styled(Heading)`
  @media (max-width: ${p => p.theme.breakpoints.md}) {
    text-align: center;
  }
`;

const Description = styled(Text)`
  @media (max-width: ${p => p.theme.breakpoints.md}) {
    text-align: center;
  }
`;

const StyledGrid = styled(Grid)`
  & > :last-child {
    justify-self: end;
  }
`;

const Separator = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  padding: 0;
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

const ReceiptPaper = styled(Container)`
  border: 1px solid ${p => p.theme.border};
  border-top: none;
  border-bottom: none;
`;

const DateSeparator = styled('div')`
  border-top: 1px dashed ${p => p.theme.gray500};
  width: 100%;
`;

const DashedContainer = styled(Container)`
  border-bottom: 1px dashed ${p => p.theme.border};
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
