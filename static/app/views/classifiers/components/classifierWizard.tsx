import {useState} from 'react';

import {useClassifierForm} from 'sentry/views/classifiers/hooks/useClassifierForm';

import {ClassifierDetailsStep} from './classifierDetailsStep';
import {
  ClassifierFiltersStep,
  type ClassifierFiltersStepProps,
} from './classifierFiltersStep';

interface ClassifierWizardProps extends Omit<
  ClassifierFiltersStepProps,
  'onNext' | 'onSelectPrebuilt' | 'prebuilt'
> {
  filterQuery: string;
}

export function ClassifierWizard({
  dataset,
  filterQuery,
  ...filtersStepProps
}: ClassifierWizardProps) {
  const [step, setStep] = useState(1);
  const {form, prebuilt, selectPrebuilt} = useClassifierForm({dataset, filterQuery});

  if (step === 1) {
    return (
      <ClassifierFiltersStep
        {...filtersStepProps}
        dataset={dataset}
        prebuilt={prebuilt}
        onNext={() => setStep(2)}
        onSelectPrebuilt={selectPrebuilt}
      />
    );
  }

  return <ClassifierDetailsStep form={form} onBack={() => setStep(1)} />;
}
