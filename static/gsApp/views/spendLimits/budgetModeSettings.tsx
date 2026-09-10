import {Grid} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {capitalize} from 'sentry/utils/string/capitalize';

import {OnDemandBudgetMode, type OnDemandBudgets, type Plan} from 'getsentry/types';
import {CheckoutOption} from 'getsentry/views/amCheckout/components/checkoutOption';
import {convertOnDemandBudget} from 'getsentry/views/spendLimits/utils';

export interface BudgetModeSettingsProps {
  activePlan: Plan;
  onDemandBudgets: OnDemandBudgets;
  onUpdate: ({onDemandBudgets}: {onDemandBudgets: OnDemandBudgets}) => void;
}

export function BudgetModeSettings({
  activePlan,
  onDemandBudgets,
  onUpdate,
}: BudgetModeSettingsProps) {
  if (!activePlan.hasOnDemandModes) {
    return null;
  }

  return (
    <Grid columns={{zero: '1fr', lg: 'repeat(2, minmax(0, 1fr))'}} gap="lg">
      {Object.values(OnDemandBudgetMode).map(budgetMode => {
        const budgetModeName = capitalize(budgetMode.replace('_', '-'));
        const isSelected = onDemandBudgets.budgetMode === budgetMode;
        const nextOnDemandBudget = convertOnDemandBudget(onDemandBudgets, budgetMode);
        return (
          <CheckoutOption
            key={budgetMode}
            ariaLabel={`${budgetModeName} spending limit mode`}
            ariaRole="radio"
            dataTestId={`budget-mode-${budgetMode}`}
            isSelected={isSelected}
            onClick={() => onUpdate({onDemandBudgets: nextOnDemandBudget})}
            optionHeader={
              <Heading as="h3" variant={isSelected ? 'accent' : 'primary'}>
                {budgetMode === OnDemandBudgetMode.PER_CATEGORY
                  ? t('Set a spending limit for each product')
                  : t('Set a spending limit shared across all products')}
              </Heading>
            }
          />
        );
      })}
    </Grid>
  );
}
