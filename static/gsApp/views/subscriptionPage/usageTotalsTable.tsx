import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import {Button} from 'sentry/components/button';
import QuestionTooltip from 'sentry/components/questionTooltip';
import TextOverflow from 'sentry/components/textOverflow';
import type {Tooltip} from 'sentry/components/tooltip';
import {IconStack} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import type {BillingStatTotal, Subscription} from 'getsentry/types';
import {formatUsageWithUnits} from 'getsentry/utils/billing';
import {getPlanCategoryName, SINGULAR_DATA_CATEGORY} from 'getsentry/utils/dataCategory';
import titleCase from 'getsentry/utils/titleCase';
import {StripedTable} from 'getsentry/views/subscriptionPage/styles';
import {displayPercentage} from 'getsentry/views/subscriptionPage/usageTotals';

type RowProps = {
  category: string;
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
  tooltipTitle?: React.ComponentProps<typeof Tooltip>['title'];
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
  category: string;
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
  category: string;
  subscription: Subscription;
  totals: BillingStatTotal;
  isEventBreakdown?: boolean;
};

function UsageTotalsTable({category, isEventBreakdown, totals, subscription}: Props) {
  function OutcomeTable({children}: {children: React.ReactNode}) {
    const categoryName = isEventBreakdown
      ? titleCase(category)
      : titleCase(
          getPlanCategoryName({
            plan: subscription.planDetails,
            category,
            hadCustomDynamicSampling: subscription.hadCustomDynamicSampling,
          })
        );

    return (
      <StyledTable>
        <thead>
          <tr>
            <th>
              <TextOverflow>
                {isEventBreakdown
                  ? tct('[singularName] Events', {
                      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                      singularName: capitalize(SINGULAR_DATA_CATEGORY[category]),
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
          name={t('Total Dropped')}
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
          <OutcomeRow
            indent
            name={t('Spike Protection')}
            quantity={totals.droppedSpikeProtection}
            category={category}
            totals={totals}
          />
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
