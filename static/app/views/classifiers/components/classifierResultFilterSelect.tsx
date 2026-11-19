import {CompactSelect} from '@sentry/scraps/compactSelect';

import {useClassifierOutput} from 'sentry/views/classifiers/hooks/useClassifierOutput';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';

export function ClassifierResultFilterSelect({
  classifier,
}: {
  classifier: TelemetryClassifier;
}) {
  const {filter, output, setFilter} = useClassifierOutput(classifier);

  if (output.filterOptions.length === 0) {
    return null;
  }

  return (
    <CompactSelect
      value={filter}
      options={output.filterOptions}
      onChange={option => setFilter(option.value)}
    />
  );
}
