import {Fragment, useCallback, useMemo, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/compactSelect';
import Pagination from 'sentry/components/pagination';
import {FunctionsTable} from 'sentry/components/profiling/suspectFunctions/functionsTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {useFunctions} from 'sentry/utils/profiling/hooks/useFunctions';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';

interface SuspectFunctionsTableProps {
  analyticsPageSource: 'performance_transaction' | 'profiling_transaction';
  project: Project | undefined;
  transaction: string;
}

const FUNCTIONS_CURSOR_NAME = 'functionsCursor';

export function SuspectFunctionsTable({
  analyticsPageSource,
  project,
  transaction,
}: SuspectFunctionsTableProps) {
  const {selection} = usePageFilters();
  const [functionType, setFunctionType] = useState<'application' | 'system' | 'all'>(
    'application'
  );
  const location = useLocation();
  const functionsCursor = useMemo(
    () => decodeScalar(location.query.functionsCursor),
    [location.query.functionsCursor]
  );
  const functionsSort = useMemo(
    () => decodeScalar(location.query.functionsSort, '-p99'),
    [location.query.functionsSort]
  );

  const handleFunctionsCursor = useCallback((cursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, [FUNCTIONS_CURSOR_NAME]: cursor},
    });
  }, []);

  const functionsQuery = useFunctions({
    cursor: functionsCursor,
    project,
    query: '', // TODO: This doesnt support the same filters
    selection,
    transaction,
    sort: functionsSort,
    functionType,
  });

  return (
    <Fragment>
      <TableHeader>
        <CompactSelect
          triggerProps={{prefix: t('Suspect Functions'), size: 'xs'}}
          value={functionType}
          options={[
            {
              label: t('All'),
              value: 'all' as const,
            },
            {
              label: t('Application'),
              value: 'application' as const,
            },
            {
              label: t('System'),
              value: 'system' as const,
            },
          ]}
          onChange={({value}) => setFunctionType(value)}
        />
        <StyledPagination
          pageLinks={
            functionsQuery.isFetched
              ? functionsQuery.data?.[2]?.getResponseHeader('Link') ?? null
              : null
          }
          onCursor={handleFunctionsCursor}
          size="xs"
        />
      </TableHeader>
      <FunctionsTable
        analyticsPageSource={analyticsPageSource}
        error={functionsQuery.isError ? functionsQuery.error.message : null}
        isLoading={functionsQuery.isLoading}
        functions={
          functionsQuery.isFetched ? functionsQuery.data?.[0].functions ?? [] : []
        }
        project={project}
        sort={functionsSort}
      />
    </Fragment>
  );
}

const TableHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(1)};
`;

const StyledPagination = styled(Pagination)`
  margin: 0 0 0 ${space(1)};
`;
