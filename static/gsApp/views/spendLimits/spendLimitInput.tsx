import type React from 'react';

import {InputGroup} from '@sentry/scraps/input';
import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

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
  fieldProps?: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>;
  indicator?: React.ReactNode;
}

export function SpendLimitInput({
  activePlan,
  budgetMode,
  onUpdate,
  currentSpendingLimit,
  category,
  reserved,
  fieldProps,
  indicator,
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
        <InputGroup.LeadingItems disablePointerEvents>
          <Text variant="muted">$</Text>
        </InputGroup.LeadingItems>
        <InputGroup.Input
          {...fieldProps}
          aria-label={t('Custom %s spending limit (in dollars)', displayName)}
          name={fieldProps?.name ?? `spending-limit-${inputName}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="300"
          value={(currentSpendingLimit / 100).toString()}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            const value = Math.max(parseInt(event.target.value, 10) || 0, 0);
            onUpdate({newData: {[inputName]: value * 100}});
          }}
        />
        {indicator && <InputGroup.TrailingItems>{indicator}</InputGroup.TrailingItems>}
      </InputGroup>
    </Container>
  );
}
