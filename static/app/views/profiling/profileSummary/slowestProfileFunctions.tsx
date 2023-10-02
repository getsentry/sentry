import {useCallback, useMemo, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import Pagination from 'sentry/components/pagination';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useProfileFunctions} from 'sentry/utils/profiling/hooks/useProfileFunctions';
import {formatSort} from 'sentry/utils/profiling/hooks/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';

import {TextTruncateOverflow} from '../../../components/profiling/textTruncateOverflow';

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

const countFormatter = Intl.NumberFormat('en-US', {});
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

  const onChangeFunctionType = useCallback(v => setFunctionType(v.value), []);
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
      <div>{functionsQuery.isLoading && 'Loading...'}</div>
      <div>{functionsQuery.error && 'Error'}</div>
      <div>
        {functionsQuery.data?.data?.map((fn, i) => (
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
                {countFormatter.format(fn['count()'] as number)},{' '}
                <PerformanceDuration nanoseconds={fn['p75()'] as number} abbreviation />
              </div>
            </SlowestFunctionMetricsRow>
          </SlowestFunctionRow>
        ))}
      </div>
    </SlowestFunctionsContainer>
  );
}

const SlowestFunctionsContainer = styled('div')`
  margin-top: ${space(0.5)};
`;

const SlowestFunctionsPagination = styled(Pagination)`
  margin: 0;
`;

const SlowestFunctionsTitleContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SlowestFunctionsTypeSelect = styled(CompactSelect)`
  button {
    margin: 0;
    padding: 0;
  }
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
