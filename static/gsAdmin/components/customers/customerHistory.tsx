import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Stack} from '@sentry/scraps/layout';

import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import oxfordizeArray from 'sentry/utils/oxfordizeArray';

import ResultGrid from 'admin/components/resultGrid';
import {RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import type {
  BillingHistory,
  ReservedBudget,
  ReservedBudgetMetricHistory,
} from 'getsentry/types';
import {formatReservedWithUnits, formatUsageWithUnits} from 'getsentry/utils/billing';
import {getPlanCategoryName, sortCategories} from 'getsentry/utils/dataCategory';
import formatCurrency from 'getsentry/utils/formatCurrency';
import {displayPriceWithCents} from 'getsentry/views/amCheckout/utils';

type Props = Partial<React.ComponentProps<typeof ResultGrid>> & {
  orgId: string;
};

function CustomerHistory({orgId, ...props}: Props) {
  return (
    <ResultGrid
      path={`/_admin/customers/${orgId}/`}
      endpoint={`/customers/${orgId}/history/`}
      method="GET"
      defaultParams={{per_page: 10}}
      useQueryString={false}
      columns={[
        <th key="period">Period</th>,
        <th key="onDemand" style={{width: 200, textAlign: 'right'}}>
          Pay-as-you-go
        </th>,
        <th key="reserved" style={{width: 200, textAlign: 'right'}}>
          Reserved
        </th>,
        <th key="gifted" style={{width: 200, textAlign: 'right'}}>
          Gifted
        </th>,
        <th key="usage" style={{width: 200, textAlign: 'right'}}>
          Usage
        </th>,
      ]}
      columnsForRow={(row: BillingHistory) => {
        const sortedCategories = sortCategories(row.categories);
        const reservedBudgets: ReservedBudget[] = row.reservedBudgets ?? [];
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
          <td key="period">
            {moment(row.periodStart).format('ll')} › {moment(row.periodEnd).format('ll')}
            <div>
              <small>
                {row.plan} — {row.planName}
                {row.isCurrent && (
                  <span>
                    {' '}
                    — <strong>Current</strong>
                  </span>
                )}
              </small>
            </div>
          </td>,
          <td key="onDemand" style={{textAlign: 'right'}}>
            {formatCurrency(row.onDemandSpend)} /{' '}
            {row.onDemandMaxSpend === -1
              ? 'unlimited'
              : formatCurrency(row.onDemandMaxSpend)}
          </td>,
          <td key="reserved" style={{textAlign: 'right'}}>
            <Stack gap="xs">
              {sortedCategories
                .filter(({reserved}) => reserved !== RESERVED_BUDGET_QUOTA)
                .map(({category, reserved}) => (
                  <div key={category}>
                    {formatReservedWithUnits(reserved, category)}
                    <DisplayName>
                      {getPlanCategoryName({
                        plan: row.planDetails,
                        category,
                        ...displayOptions,
                      })}
                    </DisplayName>
                  </div>
                ))}
              {reservedBudgets.map(budget => {
                return (
                  <div key={budget.id}>
                    {displayPriceWithCents({cents: budget.reservedBudget})} for
                    <DisplayName>{reservedBudgetNameMapping[budget.id]!}</DisplayName>
                  </div>
                );
              })}
            </Stack>
          </td>,
          <td key="gifted" style={{textAlign: 'right'}}>
            <Stack gap="xs">
              {sortedCategories
                .filter(category => category.reserved !== RESERVED_BUDGET_QUOTA)
                .map(({category, free}) => (
                  <div key={category}>
                    {formatReservedWithUnits(free, category, {
                      isGifted: true,
                    })}
                    <DisplayName>
                      {getPlanCategoryName({
                        plan: row.planDetails,
                        category,
                        ...displayOptions,
                      })}
                    </DisplayName>
                  </div>
                ))}
              {reservedBudgets.map(budget => {
                return (
                  <div key={budget.id}>
                    {displayPriceWithCents({cents: budget.freeBudget})} for
                    <DisplayName>{reservedBudgetNameMapping[budget.id]!}</DisplayName>
                  </div>
                );
              })}
            </Stack>
          </td>,
          <td key="usage" style={{textAlign: 'right'}}>
            <Stack gap="xs">
              {sortedCategories.map(({category, usage}) => (
                <div key={category}>
                  {formatUsageWithUnits(usage, category, {
                    useUnitScaling: true,
                  })}
                  <DisplayName>
                    {getPlanCategoryName({
                      plan: row.planDetails,
                      category,
                      ...displayOptions,
                    })}
                  </DisplayName>
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
          </td>,
        ];
      }}
      {...props}
    />
  );
}

const DisplayName = styled('span')`
  margin-left: ${space(0.5)};
`;

export default CustomerHistory;
