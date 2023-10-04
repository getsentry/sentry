import {useCallback, useMemo} from 'react';
import {browserHistory} from 'react-router';

import Pagination from 'sentry/components/pagination';
import {useProfileFunctionTrends} from 'sentry/utils/profiling/hooks/useProfileFunctionTrends';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';

const MAX_REGRESSED_FUNCTIONS = 5;
const REGRESSIONS_CURSOR = 'functionRegressionCursor';

interface MostRegressedProfileFunctionsProps {
  transaction: string;
}

export function MostRegressedProfileFunctions(props: MostRegressedProfileFunctionsProps) {
  const location = useLocation();

  const fnTrendCursor = useMemo(
    () => decodeScalar(location.query[REGRESSIONS_CURSOR]),
    [location.query]
  );

  const handleRegressedFunctionsCursor = useCallback((cursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, [REGRESSIONS_CURSOR]: cursor},
    });
  }, []);

  const functionQuery = useMemo(() => {
    const conditions = new MutableSearch('');
    conditions.setFilterValues('is_application', ['1']);
    conditions.setFilterValues('transaction', [props.transaction]);
    return conditions.formatString();
  }, [props.transaction]);

  const trendsQuery = useProfileFunctionTrends({
    trendFunction: 'p95()',
    trendType: 'regression',
    query: functionQuery,
    limit: MAX_REGRESSED_FUNCTIONS,
    cursor: fnTrendCursor,
  });

  return (
    <div>
      Most regressed functions
      <Pagination
        pageLinks={trendsQuery.getResponseHeader?.('Link')}
        onCursor={handleRegressedFunctionsCursor}
        size="xs"
      />
      <div>
        {trendsQuery.isLoading && 'Loading...'}
        {!trendsQuery.isLoading &&
          trendsQuery?.data?.map((t, i) => <div key={i}>{t.function}</div>)}
      </div>
    </div>
  );
}
