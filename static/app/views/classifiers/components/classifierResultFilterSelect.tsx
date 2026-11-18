import {CompactSelect} from '@sentry/scraps/compactSelect';

import {t} from 'sentry/locale';
import {useClassifierResultFilter} from 'sentry/views/classifiers/hooks/useClassifierResultFilter';
import type {
  ClassifierResultFilter,
  TelemetryClassifier,
} from 'sentry/views/classifiers/types';

const OPTIONS: Array<{label: string; value: ClassifierResultFilter}> = [
  {value: 'all', label: t('Show all')},
  {value: 'matches', label: t('Show matches')},
  {value: 'non-matches', label: t('Show non-matches')},
];

export function ClassifierResultFilterSelect({
  classifier,
}: {
  classifier: TelemetryClassifier;
}) {
  const {isBinary, resultFilter, setResultFilter} = useClassifierResultFilter(classifier);

  if (!isBinary) {
    return null;
  }

  return (
    <CompactSelect
      value={resultFilter}
      options={OPTIONS}
      onChange={option => setResultFilter(option.value)}
    />
  );
}
