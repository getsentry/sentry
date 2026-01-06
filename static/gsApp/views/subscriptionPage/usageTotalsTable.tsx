import {Fragment} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import type {TooltipProps} from 'sentry/components/core/tooltip';
import QuestionTooltip from 'sentry/components/questionTooltip';
import TextOverflow from 'sentry/components/textOverflow';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataCategory} from 'sentry/types/core';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import type {BillingStatTotal, Subscription} from 'getsentry/types';
import {
  displayPercentage,
  formatUsageWithUnits,
  getPercentage,
} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getPlanCategoryName,
  isContinuousProfiling,
} from 'getsentry/utils/dataCategory';
import {StripedTable} from 'getsentry/views/subscriptionPage/styles';

const OUTCOMES_SHOWN = [
  'accepted',
  'droppedOverQuota',
  'droppedSpikeProtection',
  'droppedOther',
];

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
   * Legend color for the bar
   */
  barColor?: string;
  /**
   * Whether the name should be bold
   */
  bold?: boolean;
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
  barColor,
  bold,
}: RowProps) {
  const amount = Math.max(quantity, 0);
  const totalUsage = totals.accepted + totals.dropped;

  const TextWrapper = tooltipTitle ? TextWithQuestionTooltip : Fragment;

  return (
    <tr>
      <td>
        <Flex
          gap="xs"
          align="center"
          paddingLeft={barColor && indent ? '3xl' : undefined}
        >
          {barColor && <OutcomeLegend color={barColor} />}
          <OutcomeType indent={!barColor && indent}>
            <TextWrapper>
              {expandButton}
              <Text bold={bold}>{name}</Text>
            </TextWrapper>
            {tooltipTitle && (
              <QuestionTooltip size="xs" position="top" title={tooltipTitle} />
            )}
          </OutcomeType>
        </Flex>
      </td>
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

function OutcomeSection({
  name,
  quantity,
  category,
  totals,
  children,
}: OutcomeSectionProps) {
  return (
    <Fragment>
      <OutcomeRow
        name={name}
        quantity={quantity}
        category={category}
        totals={totals}
        bold
      />
      {children}
    </Fragment>
  );
}

function IngestionBar({
  totals,
  totalIngested,
  outcomeToBarColor,
}: {
  outcomeToBarColor: Record<(typeof OUTCOMES_SHOWN)[number], string>;
  totalIngested: number;
  totals: BillingStatTotal;
}) {
  const displayTotals = Object.entries(totals).filter(
    ([outcome, total]) => OUTCOMES_SHOWN.includes(outcome) && total > 0
  );

  return (
    <Flex width="100%" justify="end">
      {totalIngested > 0 ? (
        displayTotals.map(([outcome, total], index) => {
          const fillPercentage = getPercentage(total, totalIngested);
          const isFirstBar = index === 0;
          const isLastBar = index === Object.entries(displayTotals).length - 1;
          const barColor = outcomeToBarColor[outcome];

          return (
            <Bar
              fillPercentage={fillPercentage}
              hasLeftBorderRadius={isFirstBar}
              hasRightBorderRadius={isLastBar}
              barColor={barColor}
              key={outcome}
            />
          );
        })
      ) : (
        <Bar fillPercentage={100} hasLeftBorderRadius hasRightBorderRadius />
      )}
    </Flex>
  );
}

function IngestionSummary({
  category,
  totals,
  outcomeToBarColor,
}: {
  category: DataCategory;
  outcomeToBarColor: Record<(typeof OUTCOMES_SHOWN)[number], string>;
  totals: BillingStatTotal;
}) {
  const totalIngested = Object.entries(totals)
    .filter(([key]) => OUTCOMES_SHOWN.includes(key))
    .reduce((acc, [_, value]) => acc + value, 0);

  return (
    <Flex direction="column" gap="md">
      <Heading as="h4">{t('Total ingested')}</Heading>
      <Flex justify="between" align="center" gap="lg">
        <Text wrap="nowrap">
          {formatUsageWithUnits(totalIngested, category, {
            useUnitScaling: true,
            isAbbreviated: true,
          })}
        </Text>

        <IngestionBar
          totals={totals}
          totalIngested={totalIngested}
          outcomeToBarColor={outcomeToBarColor}
        />
      </Flex>
    </Flex>
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
  const theme = useTheme();
  const colorPalette = theme.chart.getColorPalette(6);
  const outcomeToBarColor = {
    accepted: colorPalette[0],
    droppedOverQuota: colorPalette[3],
    droppedSpikeProtection: colorPalette[4],
    droppedOther: colorPalette[5],
  };

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
              {isEventBreakdown && (
                <TextOverflow>
                  {isEventBreakdown
                    ? tct('[singularName] Events', {
                        singularName: toTitleCase(categoryInfo?.displayName ?? category, {
                          allowInnerUpperCase: true,
                        }),
                      })
                    : categoryName}
                </TextOverflow>
              )}
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
    <Flex direction="column" gap="md" padding="md">
      <IngestionSummary
        category={category}
        totals={totals}
        outcomeToBarColor={outcomeToBarColor}
      />

      <OutcomeTable>
        <OutcomeRow
          name={t('Accepted')}
          quantity={totals.accepted}
          category={category}
          totals={totals}
          barColor={outcomeToBarColor.accepted}
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
            barColor={outcomeToBarColor.droppedOverQuota}
          />
          {hasSpikeProtection && (
            <OutcomeRow
              indent
              name={t('Spike Protection')}
              quantity={totals.droppedSpikeProtection}
              category={category}
              totals={totals}
              barColor={outcomeToBarColor.droppedSpikeProtection}
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
            barColor={outcomeToBarColor.droppedOther}
          />
        </OutcomeSection>
      </OutcomeTable>
    </Flex>
  );
}

export default UsageTotalsTable;

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

const StyledTable = styled(StripedTable)`
  width: unset;
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

const Bar = styled('div')<{
  fillPercentage: number;
  barColor?: string;
  hasLeftBorderRadius?: boolean;
  hasRightBorderRadius?: boolean;
}>`
  display: block;
  width: ${p => `${p.fillPercentage}%`};
  height: 7px;
  background: ${p => p.barColor ?? p.theme.gray200};
  border-top-left-radius: ${p => (p.hasLeftBorderRadius ? p.theme.radius.md : 0)};
  border-bottom-left-radius: ${p => (p.hasLeftBorderRadius ? p.theme.radius.md : 0)};
  border-top-right-radius: ${p => (p.hasRightBorderRadius ? p.theme.radius.md : 0)};
  border-bottom-right-radius: ${p => (p.hasRightBorderRadius ? p.theme.radius.md : 0)};
`;

const OutcomeLegend = styled('div')<{color: string}>`
  border-radius: 50%;
  background-color: ${p => p.color};
  width: 7px;
  height: 7px;
`;
