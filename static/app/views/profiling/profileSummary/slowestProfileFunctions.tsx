import {useCallback, useEffect, useMemo, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import Count from 'sentry/components/count';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {TextTruncateOverflow} from 'sentry/components/profiling/textTruncateOverflow';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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

  useEffect(() => {
    if (
      functionsQuery.isLoading ||
      functionsQuery.isError ||
      functionsQuery.data?.data?.length > 0
    ) {
      return;
    }
    Sentry.captureMessage('No regressed functions detected for flamegraph');
  }, [functionsQuery.data, functionsQuery.isLoading, functionsQuery.isError]);

  const onChangeFunctionType = useCallback(v => setFunctionType(v.value), []);
  const functions = functionsQuery.data?.data ?? [];

  return (
    <SlowestFunctionsContainer>
      <SlowestFunctionsTitleContainer>
        <SlowestFunctionsTypeSelect
          value={functionType}
          options={SLOWEST_FUNCTION_OPTIONS}
          onChange={onChangeFunctionType}
          triggerProps={TRIGGER_PROPS}
          offset={4}
        />
        <SlowestFunctionsPagination
          pageLinks={functionsQuery.getResponseHeader?.('Link')}
          onCursor={handleFunctionsCursor}
          size="xs"
        />
      </SlowestFunctionsTitleContainer>
      <div>
        {functionsQuery.isLoading ? (
          <SlowestFunctionsQueryState>
            <LoadingIndicator size={36} />
          </SlowestFunctionsQueryState>
        ) : functionsQuery.isError ? (
          <SlowestFunctionsQueryState>
            {t('Failed to fetch slowest functions')}
          </SlowestFunctionsQueryState>
        ) : !functions.length ? (
          <SlowestFunctionsQueryState>
            {t('Yikes, you have no slow functions? This should not happen.')}
          </SlowestFunctionsQueryState>
        ) : (
          functions.map((fn, i) => (
            <SlowestFunctionRow key={i}>
              <SlowestFunctionMainRow>
                <div>
                  <TextTruncateOverflow>{fn.function}</TextTruncateOverflow>
                </div>
                <div>
                  <PerformanceDuration nanoseconds={fn['sum()'] as number} abbreviation />
                </div>
              </SlowestFunctionMainRow>
              <SlowestFunctionMetricsRow>
                <div>
                  <TextTruncateOverflow>{fn.package}</TextTruncateOverflow>
                </div>
                <div>
                  <Count value={fn['count()'] as number} />
                  <PerformanceDuration nanoseconds={fn['p75()'] as number} abbreviation />
                </div>
              </SlowestFunctionMetricsRow>
            </SlowestFunctionRow>
          ))
        )}
      </div>
    </SlowestFunctionsContainer>
  );
}

const SlowestFunctionsContainer = styled('div')`
  margin-top: ${space(0.5)};
  flex: 1;
`;

const SlowestFunctionsPagination = styled(Pagination)`
  margin: 0;
`;

const SlowestFunctionsTitleContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(0.5)};
`;

const SlowestFunctionsTypeSelect = styled(CompactSelect)`
  button {
    margin: 0;
    padding: 0;
  }
`;

const SlowestFunctionsQueryState = styled('div')`
  text-align: center;
  padding: ${space(2)} ${space(0.5)};
  color: ${p => p.theme.subText};
`;

const SlowestFunctionRow = styled('div')`
  margin-bottom: ${space(0.5)};
`;

const SlowestFunctionMainRow = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SlowestFunctionMetricsRow = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const TRIGGER_PROPS = {borderless: true, size: 'zero' as const};
const SLOWEST_FUNCTION_OPTIONS: SelectOption<'application' | 'system' | 'all'>[] = [
  {
    label: t('Slowest Application Function'),
    value: 'application' as const,
  },
  {
    label: t('Slowest System Functions'),
    value: 'system' as const,
  },
  {
    label: t('Slowest Functions'),
    value: 'all' as const,
  },
];
