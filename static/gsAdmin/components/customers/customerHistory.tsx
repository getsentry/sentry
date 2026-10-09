import moment from 'moment-timezone';

import {Stack, Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {DataCategory} from 'sentry/types/core';
import {oxfordizeArray} from 'sentry/utils/oxfordizeArray';

import {RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import type {BillingHistory, ReservedBudgetMetricHistory} from 'getsentry/types';
import {formatReservedWithUnits, formatUsageWithUnits} from 'getsentry/utils/billing';
import {getPlanCategoryName, sortCategories} from 'getsentry/utils/dataCategory';
import {formatCurrency} from 'getsentry/utils/formatCurrency';
import {displayPriceWithCents} from 'getsentry/views/amCheckout/utils';

type Props = Partial<React.ComponentProps<typeof ResultGrid>> & {
  orgId: string;
};

export function CustomerHistory({orgId, ...props}: Props) {
  return (
    <ResultGrid
      path={`/_admin/customers/${orgId}/`}
      endpoint={`/customers/${orgId}/history/`}
      method="GET"
      defaultParams={{per_page: 10}}
      useQueryString={false}
      columns={[
        {key: 'period', label: 'Period'},
        {key: 'onDemand', label: 'Pay-as-you-go', width: 200, align: 'right'},
        {key: 'reserved', label: 'Reserved', width: 200, align: 'right'},
        {key: 'gifted', label: 'Gifted', width: 200, align: 'right'},
        {key: 'usage', label: 'Usage', width: 200, align: 'right'},
      ]}
      columnsForRow={(row: BillingHistory) => {
        const sortedCategories = sortCategories(row.categories);
        const reservedBudgets = row.reservedBudgets ?? [];
        const reservedBudgetMetricHistories: Record<string, ReservedBudgetMetricHistory> =
          {};
        const reservedBudgetNameMapping: Record<string, string> = {};

        // in _admin, always use DS names regardless of whether DS was actually used in the period
        // if DS is available (ie. when stored spans are billed)
        const shouldUseDynamicSamplingNames = row.planDetails
          ? DataCategory.SPANS_INDEXED in row.planDetails.planCategories
          : false;

        const displayOptions = {
          capitalize: false,
          hadCustomDynamicSampling: shouldUseDynamicSamplingNames,
        };

        reservedBudgets.forEach(budget => {
          const categoryNames: string[] = [];
          Object.entries(budget.categories).forEach(([category, history]) => {
            reservedBudgetMetricHistories[category] = history;
            categoryNames.push(
              getPlanCategoryName({
                plan: row.planDetails,
                category: category as DataCategory,
                ...displayOptions,
              })
            );
          });
          reservedBudgetNameMapping[budget.id] = oxfordizeArray(categoryNames);
        });

        return [
          <SimpleTable.RowCell key="period" direction="column" align="start" gap="xs">
            {moment(row.periodStart).format('ll')} › {moment(row.periodEnd).format('ll')}
            <Text size="xs">
              {row.plan} — {row.planName}
              {row.isCurrent && (
                <span>
                  {' '}
                  — <strong>Current</strong>
                </span>
              )}
            </Text>
          </SimpleTable.RowCell>,
          <SimpleTable.RowCell key="onDemand" justify="end">
            <Text align="right">
              {formatCurrency(row.onDemandSpend)} /{' '}
              {row.onDemandMaxSpend === -1
                ? 'unlimited'
                : formatCurrency(row.onDemandMaxSpend)}
            </Text>
          </SimpleTable.RowCell>,
          <SimpleTable.RowCell key="reserved" justify="end">
            <Stack gap="xs" align="end">
              {sortedCategories
                .filter(({reserved}) => reserved !== RESERVED_BUDGET_QUOTA)
                .map(({category, reserved}) => (
                  <div key={category}>
                    {formatReservedWithUnits(reserved, category)}
                    <Container as="span" marginLeft="xs">
                      {getPlanCategoryName({
                        plan: row.planDetails,
                        category,
                        ...displayOptions,
                      })}
                    </Container>
                  </div>
                ))}
              {reservedBudgets.map(budget => {
                return (
                  <div key={budget.id}>
                    {displayPriceWithCents({cents: budget.reservedBudget})} for
                    <Container as="span" marginLeft="xs">
                      {reservedBudgetNameMapping[budget.id]!}
                    </Container>
                  </div>
                );
              })}
            </Stack>
          </SimpleTable.RowCell>,
          <SimpleTable.RowCell key="gifted" justify="end">
            <Stack gap="xs" align="end">
              {sortedCategories
                .filter(category => category.reserved !== RESERVED_BUDGET_QUOTA)
                .map(({category, free}) => (
                  <div key={category}>
                    {formatReservedWithUnits(free, category, {
                      isGifted: true,
                    })}
                    <Container as="span" marginLeft="xs">
                      {getPlanCategoryName({
                        plan: row.planDetails,
                        category,
                        ...displayOptions,
                      })}
                    </Container>
                  </div>
                ))}
              {reservedBudgets.map(budget => {
                return (
                  <div key={budget.id}>
                    {displayPriceWithCents({cents: budget.freeBudget})} for
                    <Container as="span" marginLeft="xs">
                      {reservedBudgetNameMapping[budget.id]!}
                    </Container>
                  </div>
                );
              })}
            </Stack>
          </SimpleTable.RowCell>,
          <SimpleTable.RowCell key="usage" justify="end">
            <Stack gap="xs" align="end">
              {sortedCategories.map(({category, usage}) => (
                <div key={category}>
                  {formatUsageWithUnits(usage, category, {
                    useUnitScaling: true,
                  })}
                  <Container as="span" marginLeft="xs">
                    {getPlanCategoryName({
                      plan: row.planDetails,
                      category,
                      ...displayOptions,
                    })}
                  </Container>
                  {reservedBudgetMetricHistories[category] && (
                    <span>
                      {' ('}
                      {displayPriceWithCents({
                        cents: reservedBudgetMetricHistories[category].reservedSpend,
                      })}
                      {')'}
                    </span>
                  )}
                </div>
              ))}
            </Stack>
          </SimpleTable.RowCell>,
        ];
      }}
      {...props}
    />
  );
}
