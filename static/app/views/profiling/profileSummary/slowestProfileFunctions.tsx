import {useCallback, useMemo, useState} from 'react';
import {browserHistory} from 'react-router';

import Pagination from 'sentry/components/pagination';
import {useProfileFunctions} from 'sentry/utils/profiling/hooks/useProfileFunctions';
import {formatSort} from 'sentry/utils/profiling/hooks/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';

const FUNCTIONS_CURSOR_NAME = 'functionsCursor';

const functionsFields = [
  'package',
  'function',
  'count()',
  'p75()',
  'sum()',
  'examples()',
] as const;

type FunctionsField = (typeof functionsFields)[number];

interface SlowestProfileFunctionsProps {
  transaction: string;
}

export function SlowestProfileFunctions(props: SlowestProfileFunctionsProps) {
  const [functionType, setFunctionType] = useState<'application' | 'system' | 'all'>(
    'application'
  );
  const location = useLocation();
  const functionsCursor = useMemo(
    () => decodeScalar(location.query[FUNCTIONS_CURSOR_NAME]),
    [location.query]
  );
  const functionsSort = useMemo(
    () =>
      formatSort<FunctionsField>(
        decodeScalar(location.query.functionsSort),
        functionsFields,
        {
          key: 'sum()',
          order: 'desc',
        }
      ),
    [location.query.functionsSort]
  );

  const handleFunctionsCursor = useCallback((cursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, [FUNCTIONS_CURSOR_NAME]: cursor},
    });
  }, []);

  const query = useMemo(() => {
    const conditions = new MutableSearch('');
    conditions.setFilterValues('transaction', [props.transaction]);
    if (functionType === 'application') {
      conditions.setFilterValues('is_application', ['1']);
    } else if (functionType === 'system') {
      conditions.setFilterValues('is_application', ['0']);
    }
    return conditions.formatString();
  }, [functionType, props.transaction]);

  const functionsQuery = useProfileFunctions<FunctionsField>({
    fields: functionsFields,
    referrer: 'api.profiling.profile-summary-functions-table',
    sort: functionsSort,
    query,
    limit: 5,
    cursor: functionsCursor,
  });

  return (
    <div>
      <button onClick={() => setFunctionType('all')}>Type</button>
      <Pagination
        pageLinks={functionsQuery.getResponseHeader?.('Link')}
        onCursor={handleFunctionsCursor}
        size="xs"
      />
      <div>{functionsQuery.isLoading && 'Loading...'}</div>
      <div>{functionsQuery.error && 'Error'}</div>
      <div>
        {functionsQuery.data?.data?.map((fn, i) => (
          <div key={i}>
            {fn.function} {fn['sum()']}
          </div>
        ))}
      </div>
    </div>
  );
}
