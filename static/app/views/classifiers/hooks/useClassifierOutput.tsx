import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {ALL_RESULTS} from 'sentry/views/classifiers/constants';
import {getClassifierOutput} from 'sentry/views/classifiers/output';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';
import {getResultField} from 'sentry/views/classifiers/utils';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';

export function useClassifierOutput(classifier: TelemetryClassifier) {
  const output = getClassifierOutput(classifier);
  const [filter, setFilterState] = useQueryState(
    'results',
    parseAsStringLiteral([
      output.defaultFilter,
      ...output.filterOptions.map(o => o.value),
    ])
      .withDefault(output.defaultFilter)
      .withOptions({history: 'replace'})
  );
  const {unsetCursor} = useTableCursor();

  const setFilter = (next: string) => {
    setFilterState(next);
    unsetCursor();
  };

  return {
    output,
    filter,
    setFilter,
    isFiltered: filter !== ALL_RESULTS,
    resultField: getResultField(classifier.resultAttribute),
    resultQuery: output.getResultQuery(classifier, filter),
  };
}
