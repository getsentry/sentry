import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import type {TooltipProps} from 'sentry/components/core/tooltip';
import QuestionTooltip from 'sentry/components/questionTooltip';
import TextOverflow from 'sentry/components/textOverflow';
import {IconStack} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataCategory} from 'sentry/types/core';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import type {BillingStatTotal, Subscription} from 'getsentry/types';
import {formatUsageWithUnits} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getPlanCategoryName,
  isContinuousProfiling,
} from 'getsentry/utils/dataCategory';
import {StripedTable} from 'getsentry/views/subscriptionPage/styles';
import {displayPercentage} from 'getsentry/views/subscriptionPage/usageTotals';

type RowProps = {
  category: DataCategory;
  /**
   * Name of outcome reason (e.g. Over Quota, Spike Protection, etc.)
   */
  name: string;
  /**
   * Number of events or bytes
   */
  quantity: number;
  totals: BillingStatTotal;
  /**
   * Button to expand outcome section
   */
  expandButton?: React.ReactNode;
  /**
   * If the row should be indented
   */
  indent?: boolean;
  /**
   * Adds an info tooltip to `name`
   */
  tooltipTitle?: TooltipProps['title'];
};

function OutcomeRow({
  name,
  quantity,
  category,
  totals,
  tooltipTitle,
  expandButton,
  indent,
}: RowProps) {
  const amount = Math.max(quantity, 0);
  const totalUsage = totals.accepted + totals.dropped;

  return (
    <tr>
      {tooltipTitle ? (
        <td>
          <OutcomeType indent={indent}>
            <TextWithQuestionTooltip>
              {expandButton}
              {name}
              <QuestionTooltip size="xs" position="top" title={tooltipTitle} />
            </TextWithQuestionTooltip>
          </OutcomeType>
        </td>
      ) : (
        <td>
          <OutcomeType indent={indent}>
            {expandButton}
            {name}
          </OutcomeType>
        </td>
      )}
      <td>
        <TextOverflow>
          {formatUsageWithUnits(amount, category, {useUnitScaling: true})}
        </TextOverflow>
      </td>
      <td>
        <TextOverflow>{displayPercentage(amount, totalUsage)}</TextOverflow>
      </td>
    </tr>
  );
}

type OutcomeSectionProps = {
  category: DataCategory;
  children: React.ReactNode;
  name: string;
  quantity: number;
  totals: BillingStatTotal;
  expanded?: boolean;
  isEventBreakdown?: boolean;
};

type State = {expanded: boolean};

function OutcomeSection({
  name,
  quantity,
  isEventBreakdown,
  category,
  totals,
  children,
}: OutcomeSectionProps) {
  const [state, setState] = useState<State>({expanded: !isEventBreakdown});

  const expandButton = (
    <StyledButton
      data-test-id="expand-dropped-totals"
      size="zero"
      onClick={() => setState({expanded: !state.expanded})}
      icon={<IconStack size="xs" direction={state.expanded ? 'up' : 'down'} />}
      aria-label={t('Expand dropped totals')}
    />
  );
  return (
    <Fragment>
      <OutcomeRow
        name={name}
        quantity={quantity}
        expandButton={expandButton}
        category={category}
        totals={totals}
      />
      {state.expanded && children}
    </Fragment>
  );
}

type Props = {
  category: DataCategory;
  subscription: Subscription;
  totals: BillingStatTotal;
  isEventBreakdown?: boolean;
};

function UsageTotalsTable({category, isEventBreakdown, totals, subscription}: Props) {
  const categoryInfo = getCategoryInfoFromPlural(category);

  function OutcomeTable({children}: {children: React.ReactNode}) {
    const categoryName = isEventBreakdown
      ? toTitleCase(category, {allowInnerUpperCase: true})
      : getPlanCategoryName({
          plan: subscription.planDetails,
          category,
          hadCustomDynamicSampling: subscription.hadCustomDynamicSampling,
          title: true,
        });

    const testId = isEventBreakdown
      ? `event-table-${category}`
      : `category-table-${category}`;

    return (
      <StyledTable data-test-id={testId}>
        <thead>
          <tr>
            <th>
              <TextOverflow>
                {isEventBreakdown
                  ? tct('[singularName] Events', {
                      singularName: toTitleCase(categoryInfo?.displayName ?? category, {
                        allowInnerUpperCase: true,
                      }),
                    })
                  : categoryName}
              </TextOverflow>
            </th>
            <th>
              <TextOverflow>{t('Quantity')}</TextOverflow>
            </th>
            <th>
              <TextOverflow>{tct('% of [categoryName]', {categoryName})}</TextOverflow>
            </th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </StyledTable>
    );
  }
  const totalDropped = isContinuousProfiling(category)
    ? t('Total Dropped (estimated)')
    : t('Total Dropped');

  const hasSpikeProtection = categoryInfo?.hasSpikeProtection ?? false;

  return (
    <UsageTableWrapper>
      <OutcomeTable>
        <OutcomeRow
          name={t('Accepted')}
          quantity={totals.accepted}
          category={category}
          totals={totals}
        />
        <OutcomeSection
          isEventBreakdown={isEventBreakdown}
          name={totalDropped}
          quantity={totals.dropped}
          category={category}
          totals={totals}
        >
          <OutcomeRow
            indent
            name={t('Over Quota')}
            quantity={totals.droppedOverQuota}
            category={category}
            totals={totals}
          />
          {hasSpikeProtection && (
            <OutcomeRow
              indent
              name={t('Spike Protection')}
              quantity={totals.droppedSpikeProtection}
              category={category}
              totals={totals}
            />
          )}
          <OutcomeRow
            indent
            name={t('Other')}
            quantity={totals.droppedOther}
            category={category}
            totals={totals}
            tooltipTitle={t(
              'The dropped other category is for all uncategorized dropped events. This is commonly due to user configured rate limits.'
            )}
          />
        </OutcomeSection>
      </OutcomeTable>
    </UsageTableWrapper>
  );
}

export default UsageTotalsTable;

const StyledButton = styled(Button)`
  border-radius: 20px;
  padding: ${space(0.25)} ${space(1)};
  margin-right: ${space(1)};
`;

const OutcomeType = styled(TextOverflow)<{indent?: boolean}>`
  display: grid;
  grid-template-columns: max-content min-content;
  align-items: center;

  ${p =>
    p.indent &&
    css`
      padding-left: 38px;
    `};
`;

const TextWithQuestionTooltip = styled('div')`
  display: grid;
  grid-template-columns: max-content min-content;
  align-items: center;
  gap: ${space(1)};
`;

const UsageTableWrapper = styled('div')`
  display: grid;
  grid-auto-flow: row;
  gap: ${space(3)};
  padding: ${space(1)} 0;
`;

const StyledTable = styled(StripedTable)`
  table-layout: fixed;

  th,
  td {
    padding: ${space(1)};
    text-align: right;
  }
  th:first-child,
  td:first-child {
    text-align: left;
  }
  th:first-child {
    padding-left: 0;
  }
`;
