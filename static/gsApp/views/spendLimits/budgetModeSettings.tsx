import {Flex, Grid} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';
import {ToggleCard} from '@sentry/scraps/toggleCard';

import {t} from 'sentry/locale';
import {capitalize} from 'sentry/utils/string/capitalize';

import {OnDemandBudgetMode, type OnDemandBudgets, type Plan} from 'getsentry/types';
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
    <Grid
      columns={{zero: '1fr', lg: 'repeat(2, minmax(0, 1fr))'}}
      gap="lg"
      role="radiogroup"
      aria-label={t('Spending limit mode')}
    >
      {Object.values(OnDemandBudgetMode).map(budgetMode => {
        const budgetModeName = capitalize(budgetMode.replace('_', '-'));
        const isSelected = onDemandBudgets.budgetMode === budgetMode;
        const nextOnDemandBudget = convertOnDemandBudget(onDemandBudgets, budgetMode);
        return (
          <ToggleCard
            name="spending-limit-mode"
            key={budgetMode}
            value={budgetMode}
            aria-label={`${budgetModeName} spending limit mode`}
            variant="radio"
            checked={isSelected}
            onChange={() => onUpdate({onDemandBudgets: nextOnDemandBudget})}
          >
            <Flex align="start" gap="md">
              <ToggleCard.Indicator />
              <Heading as="h3" variant={isSelected ? 'accent' : 'primary'}>
                {budgetMode === OnDemandBudgetMode.PER_CATEGORY
                  ? t('Set a spending limit for each product')
                  : t('Set a spending limit shared across all products')}
              </Heading>
            </Flex>
          </ToggleCard>
        );
      })}
    </Grid>
  );
}
