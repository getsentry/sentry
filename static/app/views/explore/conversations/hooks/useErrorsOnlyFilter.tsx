import {parseAsBoolean, useQueryState} from 'nuqs';

const ERRORS_ONLY_URL_PARAM = 'errorsOnly';

// `conversation.errors` counts spans whose status is not ok, cancelled, or
// unknown, so this also matches statuses like `internal_error` that a plain
// `span.status:error` filter would miss. It matches the table's Errors column.
const ERRORS_ONLY_QUERY = 'conversation.errors:>0';

export function useErrorsOnlyFilter() {
  const [errorsOnly, setErrorsOnly] = useQueryState(
    ERRORS_ONLY_URL_PARAM,
    parseAsBoolean.withDefault(false).withOptions({history: 'replace'})
  );

  return {
    errorsOnly,
    // Remove the param instead of writing `errorsOnly=false` to the URL.
    setErrorsOnly: (value: boolean) => setErrorsOnly(value ? true : null),
    errorsOnlyQuery: errorsOnly ? ERRORS_ONLY_QUERY : '',
  };
}
