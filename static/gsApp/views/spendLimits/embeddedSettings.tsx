import {useState} from 'react';

import type {OnDemandBudgets} from 'getsentry/types';
import type {SpendLimitSettingsProps} from 'getsentry/views/spendLimits/spendLimitSettings';
import SpendLimitSettings from 'getsentry/views/spendLimits/spendLimitSettings';

interface EmbeddedSpendLimitSettingsProps
  extends Omit<SpendLimitSettingsProps, 'isOpen' | 'onDemandBudgets'> {
  initialOnDemandBudgets: OnDemandBudgets;
}

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
      isOpen
      onDemandBudgets={currentOnDemandBudgets}
      onUpdate={handleUpdate}
    />
  );
}

export default EmbeddedSpendLimitSettings;
