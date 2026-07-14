import {useCallback} from 'react';

import type {Sort} from 'sentry/utils/discover/fields';
import {usePersistedLogsPageParams} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useLogItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {useValidatedExploreColumns} from 'sentry/views/explore/hooks/useValidatedExploreColumns';
import {HiddenLogSearchFields} from 'sentry/views/explore/logs/constants';
import {useValidateLogsTab} from 'sentry/views/explore/logs/useValidateLogsTab';
import {
  useQueryParamsMode,
  useSetQueryParamsFields,
} from 'sentry/views/explore/queryParams/context';

export function useValidatedLogsTabColumns() {
  const mode = useQueryParamsMode();
  const setFields = useSetQueryParamsFields();
  const [_, setPersistentParams] = usePersistedLogsPageParams();

  const {attributes: stringAttributes} = useLogItemAttributes(
    {},
    'string',
    HiddenLogSearchFields
  );
  const {attributes: numberAttributes} = useLogItemAttributes(
    {},
    'number',
    HiddenLogSearchFields
  );
  const {attributes: booleanAttributes} = useLogItemAttributes(
    {},
    'boolean',
    HiddenLogSearchFields
  );
  const {data: validationData, isFetching: isValidatingColumns} = useValidateLogsTab();

  const persistCleanedFields = useCallback(
    (fields: string[], sortBys: Sort[]) => {
      setPersistentParams(prev => ({...prev, fields, sortBys}));
    },
    [setPersistentParams]
  );

  const validatedColumnData = useValidatedExploreColumns({
    attributes: {
      boolean: booleanAttributes,
      number: numberAttributes,
      string: stringAttributes,
    },
    isValidating: isValidatingColumns,
    onFieldsCleanup: persistCleanedFields,
    shouldCleanupAggregateColumns: mode === Mode.AGGREGATE,
    shouldCleanupColumns: true,
    validationData,
  });

  const onColumnsChange = useCallback(
    (newFields: string[]) => {
      setPersistentParams(prev => ({
        ...prev,
        fields: newFields,
      }));
      setFields(newFields);
    },
    [setFields, setPersistentParams]
  );

  return {...validatedColumnData, isValidatingColumns, onColumnsChange};
}
