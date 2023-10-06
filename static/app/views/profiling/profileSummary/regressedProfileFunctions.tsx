import {useCallback, useMemo} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useProfileFunctionTrends} from 'sentry/utils/profiling/hooks/useProfileFunctionTrends';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';

const REGRESSED_FUNCTIONS_LIMIT = 5;
const REGRESSED_FUNCTIONS_CURSOR = 'functionRegressionCursor';

interface MostRegressedProfileFunctionsProps {
  transaction: string;
}

export function MostRegressedProfileFunctions(props: MostRegressedProfileFunctionsProps) {
  const location = useLocation();

  const fnTrendCursor = useMemo(
    () => decodeScalar(location.query[REGRESSED_FUNCTIONS_CURSOR]),
    [location.query]
  );

  const handleRegressedFunctionsCursor = useCallback((cursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, [REGRESSED_FUNCTIONS_CURSOR]: cursor},
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
    limit: REGRESSED_FUNCTIONS_LIMIT,
    cursor: fnTrendCursor,
  });

  const trends = trendsQuery?.data ?? [];

  return (
    <RegressedFunctionsContainer>
      <RegressedFunctionsTitleContainer>
        <RegressedFunctionsTitle>{t('Most regressed functions')}</RegressedFunctionsTitle>
        <RegressedFunctionsPagination
          pageLinks={trendsQuery.getResponseHeader?.('Link')}
          onCursor={handleRegressedFunctionsCursor}
          size="xs"
        />
      </RegressedFunctionsTitleContainer>
      {trendsQuery.isLoading ? (
        <RegressedFunctionsQueryState>
          <LoadingIndicator size={36} />
        </RegressedFunctionsQueryState>
      ) : trendsQuery.isError ? (
        <RegressedFunctionsQueryState>
          {t('Failed to fetch regressed functions')}
        </RegressedFunctionsQueryState>
      ) : !trends.length ? (
        <RegressedFunctionsQueryState>
          {t('Horay, no regressed functions detected!')}
        </RegressedFunctionsQueryState>
      ) : (
        trends.map((f, i) => <div key={i}>{f.function}</div>)
      )}
    </RegressedFunctionsContainer>
  );
}

const RegressedFunctionsContainer = styled('div')`
  flex-basis: 80px;
  margin-top: ${space(0.5)};
`;

const RegressedFunctionsPagination = styled(Pagination)`
  margin: 0;
`;

const RegressedFunctionsTitleContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(0.5)};
`;

const RegressedFunctionsQueryState = styled('div')`
  text-align: center;
  padding: ${space(2)} ${space(0.5)};
  color: ${p => p.theme.subText};
`;

const RegressedFunctionsTitle = styled('div')`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.form.md.fontSize};
  font-weight: 700;
`;
