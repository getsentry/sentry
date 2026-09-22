import {InputGroup} from '@sentry/scraps/input';
import {Container} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';

import {OnDemandBudgetMode, type Plan} from 'getsentry/types';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';

export type PartialSpendLimitUpdate = Partial<Record<DataCategory, number>> & {
  sharedMaxBudget?: number;
};

export interface SpendLimitInputProps {
  activePlan: Plan;
  budgetMode: OnDemandBudgetMode;
  category: DataCategory | null;
  currentSpendingLimit: number;
  onUpdate: ({newData}: {newData: PartialSpendLimitUpdate}) => void;
  reserved: number | null;
}

export function SpendLimitInput({
  activePlan,
  budgetMode,
  onUpdate,
  currentSpendingLimit,
  category,
  reserved,
}: SpendLimitInputProps) {
  const isPerCategory =
    budgetMode === OnDemandBudgetMode.PER_CATEGORY &&
    category !== null &&
    reserved !== null;
  const inputName = isPerCategory ? category : 'sharedMaxBudget';
  const displayName = isPerCategory
    ? getPlanCategoryName({
        plan: activePlan,
        category,
        capitalize: false,
      })
    : 'shared';

  return (
    <Container width="100%">
      <InputGroup>
        <InputGroup.LeadingItems disablePointerEvents>$</InputGroup.LeadingItems>
        <InputGroup.Input
          aria-label={t('Custom %s spending limit (in dollars)', displayName)}
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="300"
          value={(currentSpendingLimit / 100).toString()}
          onChange={event => {
            const value = Math.max(parseInt(event.target.value, 10) || 0, 0);
            onUpdate({newData: {[inputName]: value * 100}});
          }}
        />
      </InputGroup>
    </Container>
  );
}
