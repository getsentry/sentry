import {useCallback} from 'react';
import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {
  CLASSIFIER_RESULT_FILTERS,
  type ClassifierResultFilter,
  type TelemetryClassifier,
} from 'sentry/views/classifiers/types';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';

const resultFilterParser = parseAsStringLiteral(CLASSIFIER_RESULT_FILTERS)
  .withDefault('matches')
  .withOptions({history: 'replace'});

export function useClassifierResultFilter(classifier: TelemetryClassifier) {
  const [resultFilter, setResultFilterState] = useQueryState(
    'results',
    resultFilterParser
  );
  const {unsetCursor} = useTableCursor();
  const isBinary =
    classifier.outputType === 'binary' && classifier.binaryThreshold !== null;

  const setResultFilter = useCallback(
    (nextFilter: ClassifierResultFilter) => {
      setResultFilterState(nextFilter);
      unsetCursor();
    },
    [setResultFilterState, unsetCursor]
  );

  const effectiveFilter: ClassifierResultFilter = isBinary ? resultFilter : 'all';

  return {isBinary, resultFilter: effectiveFilter, setResultFilter};
}
