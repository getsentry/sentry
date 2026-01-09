import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Container} from '@sentry/scraps/layout';

import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataCategory} from 'sentry/types/core';

import {useRecurringCredits} from 'getsentry/hooks/useRecurringCredits';
import type {CreditType, Plan, RecurringCredit} from 'getsentry/types';
import {formatReservedWithUnits} from 'getsentry/utils/billing';
import {getCreditDataCategory, getPlanCategoryName} from 'getsentry/utils/dataCategory';
import {displayPrice} from 'getsentry/views/amCheckout/utils';

import {AlertStripedTable, PanelBodyWithTable} from './styles';

const isExpired = (date: moment.MomentInput) => {
  return moment(date).utc().startOf('day') < moment().utc().startOf('day');
};

const getActiveDiscounts = (recurringCredits: RecurringCredit[]) =>
  recurringCredits.filter(
    credit =>
      (credit.type === 'discount' || credit.type === 'percent') &&
      credit.totalAmountRemaining > 0 &&
      !isExpired(credit.periodEnd)
  );

type Props = {
  displayType: 'data' | 'discount';
  planDetails: Plan;
};

function RecurringCredits({displayType, planDetails}: Props) {
  const {recurringCredits, isLoading} = useRecurringCredits();
  if (isLoading) {
    return null;
  }

  const displayDiscounts = displayType === 'discount';

  const getCredits = () => {
    if (displayDiscounts) {
      return getActiveDiscounts(recurringCredits);
    }
    return recurringCredits.filter(
      credit => getCreditDataCategory(credit) && !isExpired(credit.periodEnd)
    );
  };

  const credits = getCredits();
  if (!credits.length) {
    return null;
  }

  const getTooltipTitle = (credit: RecurringCredit) => {
    return credit.type === 'discount' || credit.type === 'percent'
      ? tct('[amount] per month or [annualAmount] remaining towards an annual plan.', {
          amount: displayPrice({cents: credit.amount}),
          annualAmount: displayPrice({
            cents: Math.min(credit.amount * 12, credit.totalAmountRemaining),
          }),
        })
      : undefined;
  };

  const getAmount = (credit: RecurringCredit, category: DataCategory | CreditType) => {
    if (credit.type === 'discount' || credit.type === 'percent') {
      return (
        <Fragment>
          {tct('[amount]/mo', {
            amount: displayPrice({cents: credit.amount}),
          })}
          <StyledQuestionTooltip title={getTooltipTitle(credit)} size="xs" />
        </Fragment>
      );
    }

    return `+${formatReservedWithUnits(credit.amount, category as DataCategory, {
      isAbbreviated: true,
      useUnitScaling: true,
    })}/mo`;
  };

  return (
    <Container
      background="primary"
      border="primary"
      radius="md"
      data-test-id="recurring-credits-panel"
    >
      <StyledPanelBody withPadding>
        <div>
          <h4>{t('Recurring Credits')}</h4>
          <SubText>{t('A summary of your active recurring credits.')}</SubText>
        </div>
        <div>
          <AlertStripedTable>
            <thead>
              <tr>
                <th>{t('Type')}</th>
                <th>{t('Amount')}</th>
                <th>{t('Ends on')}</th>
              </tr>
            </thead>
            <tbody>
              {credits.map((credit, index) => {
                const category = getCreditDataCategory(credit);

                return (
                  <tr key={index}>
                    {category ? (
                      <Title>
                        {getPlanCategoryName({
                          plan: planDetails,
                          category,
                          capitalize: false,
                        })}
                      </Title>
                    ) : (
                      <Title>{credit.type}</Title>
                    )}

                    <td data-test-id="amount">
                      <span>{getAmount(credit, category ?? credit.type)}</span>
                    </td>
                    <td data-test-id="end-date">
                      {moment(credit.periodEnd).format('ll')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </AlertStripedTable>
        </div>
      </StyledPanelBody>
    </Container>
  );
}

export default RecurringCredits;

const StyledPanelBody = styled(PanelBodyWithTable)`
  h4 {
    margin-bottom: ${space(1.5)};
  }
`;

const SubText = styled('p')`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.tokens.content.secondary};
`;

const Title = styled('td')`
  text-transform: capitalize;
`;

const StyledQuestionTooltip = styled(QuestionTooltip)`
  margin-left: ${space(0.5)};
`;
