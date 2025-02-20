import type {ReactNode} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import {IconArrow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {getFormattedDate} from 'sentry/utils/dates';

import type {PreviewData, Subscription} from 'getsentry/types';
import {formatReservedWithUnits} from 'getsentry/utils/billing';
import {displayPriceWithCents} from 'getsentry/views/amCheckout/utils';

import type {Reservations} from './types';

type Props = {
  organization: Organization;
  previewData: PreviewData;
  reservations: Reservations;
  subscription: Subscription;
};

function PlanTable({organization, previewData, reservations, subscription}: Props) {
  const hasBillingAccess = organization.access?.includes('org:billing');

  const planName = subscription.planDetails.name;
  const abbr = {isAbbreviated: true};

  const {billedAmount, creditApplied, effectiveAt} = previewData;

  const effectiveNow = new Date(effectiveAt).getTime() <= new Date().getTime() + 3600;

  return (
    <Fragment>
      <Wrapper>
        <TableItem prev={planName} next={planName}>
          {t('Plan Type')}
        </TableItem>

        <TableItem
          prev={formatReservedWithUnits(
            subscription.categories.errors?.reserved ?? null,
            DataCategory.ERRORS,
            abbr
          )}
          next={formatReservedWithUnits(
            reservations.reservedErrors,
            DataCategory.ERRORS,
            abbr
          )}
        >
          {t('Errors')}
        </TableItem>

        <TableItem
          prev={formatReservedWithUnits(
            subscription.categories.transactions?.reserved ?? null,
            DataCategory.TRANSACTIONS,
            abbr
          )}
          next={formatReservedWithUnits(
            reservations.reservedTransactions,
            DataCategory.TRANSACTIONS,
            abbr
          )}
        >
          {t('Performance Units')}
        </TableItem>

        <TableItem
          prev={0}
          next={formatReservedWithUnits(500, DataCategory.REPLAYS, abbr)}
        >
          {t('Replays')}
        </TableItem>

        <TableItem
          prev={formatReservedWithUnits(
            subscription.categories.attachments?.reserved ?? null,
            DataCategory.ATTACHMENTS,
            abbr
          )}
          next={formatReservedWithUnits(
            reservations.reservedAttachments,
            DataCategory.ATTACHMENTS,
            abbr
          )}
        >
          {t('Attachments')}
        </TableItem>

        {billedAmount === 0 ? null : (
          <TableItem
            isTotal
            prev={displayPriceWithCents({
              cents: billedAmount === 0 ? 0 : subscription.planDetails.totalPrice,
            })}
            next={displayPriceWithCents({
              cents: subscription.planDetails.totalPrice + billedAmount + creditApplied,
            })}
          >
            {t('Price Change')}
          </TableItem>
        )}

        <TableItem
          isTotal
          prev={displayPriceWithCents({
            cents: billedAmount,
          })}
          next={displayPriceWithCents({
            cents: billedAmount,
          })}
        >
          {t('Total Due')}
        </TableItem>

        {hasBillingAccess && !effectiveNow ? (
          <Fragment>
            <PlanLabel isTotal />
            <PlanValue isTotal>
              <EffectiveDate>
                {tct('Effective on [date]', {date: getFormattedDate(effectiveAt, 'll')})}
              </EffectiveDate>
            </PlanValue>
          </Fragment>
        ) : null}
      </Wrapper>
    </Fragment>
  );
}

function TableItem({
  children,
  next,
  prev,
  isTotal,
}: {
  children: ReactNode;
  next: string | number;
  prev: string | number;
  isTotal?: boolean;
}) {
  if (prev === next) {
    return (
      <Fragment>
        <PlanLabel isTotal={isTotal}>{children}</PlanLabel>
        <PlanValue isTotal={isTotal}>{next}</PlanValue>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <PlanLabel isTotal={isTotal}>{children}</PlanLabel>
      <PlanValue isTotal={isTotal}>
        {prev}
        <IconArrow color="gray300" size="xs" direction="right" />
        <strong>{next}</strong>
      </PlanValue>
    </Fragment>
  );
}

const Wrapper = styled('dl')`
  display: grid;
  grid-template-columns: max-content minmax(max-content, auto);
`;

const PlanLabel = styled('dt')<{hasChanged?: boolean; isTotal?: boolean}>`
  padding: ${p => (p.isTotal ? space(1) : `${space(0.5)} ${space(1)}`)};

  font-weight: ${p => (p.hasChanged || p.isTotal ? 'bold' : 'normal')};
  background: ${p => (p.isTotal ? p.theme.purple100 : 'transparent')};
`;

const PlanValue = styled(PlanLabel)`
  text-align: right;

  & > svg {
    position: relative;
    top: 1px;
    margin-inline: ${space(0.5)};
  }
`;

const EffectiveDate = styled('span')`
  font-size: ${p => p.theme.fontSizeExtraSmall};
  text-align: right;
`;

export default PlanTable;
