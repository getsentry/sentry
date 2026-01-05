import {useState} from 'react';

import type {OnDemandBudgets} from 'getsentry/types';
import type {SpendLimitSettingsProps} from 'getsentry/views/spendLimits/spendLimitSettings';
import SpendLimitSettings from 'getsentry/views/spendLimits/spendLimitSettings';

interface EmbeddedSpendLimitSettingsProps
  extends Omit<SpendLimitSettingsProps, 'isOpen' | 'onDemandBudgets'> {
  initialOnDemandBudgets: OnDemandBudgets;
}

/**
 * A wrapper for the SpendLimitSettings component that allows for embedded use in other components,
 * without controlling state or mutations directly.
 */
function EmbeddedSpendLimitSettings(props: EmbeddedSpendLimitSettingsProps) {
  const {initialOnDemandBudgets, onUpdate} = props;
  const [currentOnDemandBudgets, setCurrentOnDemandBudgets] =
    useState<OnDemandBudgets>(initialOnDemandBudgets);

  const handleUpdate = ({onDemandBudgets}: {onDemandBudgets: OnDemandBudgets}) => {
    setCurrentOnDemandBudgets(onDemandBudgets);
    onUpdate({onDemandBudgets});
  };

  return (
    <SpendLimitSettings
      {...props}
      onDemandBudgets={currentOnDemandBudgets}
      onUpdate={handleUpdate}
    />
  );
}

export default EmbeddedSpendLimitSettings;
