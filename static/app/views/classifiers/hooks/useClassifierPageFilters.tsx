import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';
import {filterQueryHasEnvironment} from 'sentry/views/classifiers/utils';

export function useClassifierPageFilters(classifier: TelemetryClassifier) {
  const {selection} = usePageFilters();
  return {
    ...selection,
    environments: filterQueryHasEnvironment(classifier.filterQuery)
      ? []
      : selection.environments,
  };
}
