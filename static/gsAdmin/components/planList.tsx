import {Fragment} from 'react';
import styled from '@emotion/styled';

import SelectField from 'sentry/components/forms/fields/selectField';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';

import type {DataCategories, Plan, Subscription} from 'getsentry/types';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';
import formatCurrency from 'getsentry/utils/formatCurrency';
import titleCase from 'getsentry/utils/titleCase';

export type LimitName =
  | 'reservedErrors'
  | 'reservedAttachments'
  | 'reservedReplays'
  | 'reservedTransactions'
  | 'reservedMonitorSeats'
  | 'reservedUptime'
  | 'reservedSpans'
  | 'reservedProfileDuration'
  | 'reservedProfileDurationUI';

type Props = {
  onLimitChange: (category: DataCategory, value: number) => void;
  onPlanChange: (planId: string) => void;
  planId: null | string;
  plans: Plan[];
  reserved: {
    [key in DataCategory]?: number | null;
  };
  currentSubscription?: Subscription | null;
};

const configurableCategories: DataCategory[] = [
  DataCategory.ERRORS,
  DataCategory.REPLAYS,
  DataCategory.TRANSACTIONS,
  DataCategory.ATTACHMENTS,
  DataCategory.MONITOR_SEATS,
  DataCategory.UPTIME,
  DataCategory.SPANS,
];

function PlanList({
  plans,
  planId,
  reserved,
  onPlanChange,
  onLimitChange,
  currentSubscription,
}: Props) {
  const changeValue = {
    6000000: '6M',
    5000000: '5M',
    4000000: '4M',
    3000000: '3M',
    1500000: '1.5M',
    500000: '500k',
    100000: '100K',
  };
  if (!plans.length) {
    return null;
  }
  function handleLimitChange(category: DataCategory) {
    return function handleChange(value: string) {
      onLimitChange(category, parseInt(value, 10));
    };
  }
  const activePlan = plans.find(plan => plan.id === planId);

  // Helper to get current value display for a category
  const getCurrentValueDisplay = (category: DataCategory, fieldName: LimitName) => {
    if (!currentSubscription) {
      return null;
    }

    // Check if categories exist
    if (currentSubscription.categories) {
      // Get the category data using type assertion to allow string indexing
      const categories = currentSubscription.categories as Record<
        string,
        {reserved?: number}
      >;
      const categoryKey = category.toLowerCase();

      if (categories[categoryKey] && categories[categoryKey].reserved !== undefined) {
        const reservedValue = categories[categoryKey].reserved;

        return (
          <CurrentValueText>
            Current: {reservedValue.toLocaleString()}{' '}
            {category === DataCategory.ATTACHMENTS ? 'GB' : ''}
          </CurrentValueText>
        );
      }
    }

    // Fallback to the old method if categories data is not available
    const currentValue = (currentSubscription as Record<string, any>)[fieldName];
    if (currentValue === null || currentValue === undefined) {
      return null;
    }

    return (
      <CurrentValueText>
        Current: {currentValue.toLocaleString()}{' '}
        {category === DataCategory.ATTACHMENTS ? 'GB' : ''}
      </CurrentValueText>
    );
  };

  return (
    <Fragment>
      {plans.map(plan => (
        <div key={plan.id}>
          <PlanLabel>
            <div>
              <input
                data-test-id={`change-plan-radio-btn-${plan.id}`}
                type="radio"
                name="plan"
                value={plan.id}
                onChange={() => onPlanChange(plan.id)}
              />
            </div>
            <div>
              <strong>
                {plan.name}{' '}
                {
                  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                  changeValue[plan.reservedMinimum] ?? ''
                }
              </strong>{' '}
              <SubText>— {plan.id}</SubText>
              <br />
              <small>
                {formatCurrency(plan.price)} /{' '}
                {plan.billingInterval === 'annual' ? 'annually' : 'monthly'}
              </small>
            </div>
          </PlanLabel>
        </div>
      ))}
      {activePlan &&
        (
          activePlan?.planCategories.transactions ||
          activePlan?.planCategories.spans ||
          []
        ).length > 1 && (
          <div>
            <h4>Reserved Volumes</h4>
            {activePlan.categories
              .filter(category =>
                configurableCategories.includes(category as DataCategory)
              )
              .map(category => {
                const titleCategory = getPlanCategoryName({plan: activePlan, category});
                const reservedKey = `reserved${
                  titleCase(category[0]!) + category.substring(1, category.length)
                }`;
                const label =
                  category === DataCategory.ATTACHMENTS
                    ? `${titleCategory} (GB)`
                    : titleCategory;
                const fieldValue = reserved[category as DataCategory] ?? null;
                const currentValueDisplay = getCurrentValueDisplay(
                  category as DataCategory,
                  reservedKey as LimitName
                );
                return (
                  <SelectFieldWrapper key={`test-${category}`}>
                    <SelectField
                      inline={false}
                      stacked
                      name={`${reservedKey}`}
                      label={label}
                      value={fieldValue}
                      options={(
                        activePlan.planCategories[category as DataCategories] || []
                      ).map(level => ({
                        label: level.events.toLocaleString(),
                        value: level.events,
                      }))}
                      required
                      onChange={handleLimitChange(category as DataCategory)}
                    />
                    {currentValueDisplay}
                  </SelectFieldWrapper>
                );
              })}
          </div>
        )}
    </Fragment>
  );
}

const PlanLabel = styled('label')`
  margin-bottom: 10px;

  display: flex;
  align-items: flex-start;

  & > div {
    margin-right: ${space(3)};
  }
`;

const SubText = styled('small')`
  font-weight: normal;
  color: #999;
`;

const SelectFieldWrapper = styled('div')`
  position: relative;
`;

const CurrentValueText = styled('div')`
  color: #666;
  font-size: 0.9em;
  margin-top: -8px;
  margin-bottom: 10px;
  font-style: italic;
`;

export default PlanList;
