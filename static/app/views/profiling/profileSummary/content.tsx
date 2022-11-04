import {useCallback, useMemo, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {SectionHeading} from 'sentry/components/charts/styles';
import CompactSelect from 'sentry/components/compactSelect';
import * as Layout from 'sentry/components/layouts/thirds';
import Pagination from 'sentry/components/pagination';
import {FunctionsTable} from 'sentry/components/profiling/functionsTable';
import {ProfileEventsTable} from 'sentry/components/profiling/profileEventsTable';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {PageFilters, Project} from 'sentry/types';
import {useFunctions} from 'sentry/utils/profiling/hooks/useFunctions';
import {
  formatSort,
  useProfileEvents,
} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {decodeScalar} from 'sentry/utils/queryString';

const FUNCTIONS_CURSOR_NAME = 'functionsCursor';

interface ProfileSummaryContentProps {
  location: Location;
  project: Project;
  query: string;
  selection: PageFilters;
  transaction: string;
}

function ProfileSummaryContent(props: ProfileSummaryContentProps) {
  const profilesCursor = useMemo(
    () => decodeScalar(props.location.query.cursor),
    [props.location.query.cursor]
  );

  const functionsCursor = useMemo(
    () => decodeScalar(props.location.query.functionsCursor),
    [props.location.query.functionsCursor]
  );

  const functionsSort = useMemo(
    () => decodeScalar(props.location.query.functionsSort, '-p99'),
    [props.location.query.functionsSort]
  );

  const sort = formatSort<FieldType>(decodeScalar(props.location.query.sort), FIELDS, {
    key: 'timestamp',
    order: 'desc',
  });

  const profiles = useProfileEvents<FieldType>({
    cursor: profilesCursor,
    fields: FIELDS,
    sort,
    limit: 5,
  });

  const [functionType, setFunctionType] = useState<'application' | 'system' | 'all'>(
    'application'
  );

  const functions = useFunctions({
    cursor: functionsCursor,
    project: props.project,
    query: props.query,
    selection: props.selection,
    transaction: props.transaction,
    sort: functionsSort,
    functionType,
  });

  const handleFunctionsCursor = useCallback((cursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, [FUNCTIONS_CURSOR_NAME]: cursor},
    });
  }, []);

  return (
    <Layout.Main fullWidth>
      <TableHeader>
        <SectionHeading>{t('Recent Profiles')}</SectionHeading>
        <StyledPagination
          pageLinks={
            profiles.status === 'success'
              ? profiles.data?.[2]?.getResponseHeader('Link') ?? null
              : null
          }
          size="xs"
        />
      </TableHeader>
      <ProfileEventsTable
        columns={FIELDS}
        data={profiles.status === 'success' ? profiles.data[0] : null}
        error={profiles.status === 'error' ? t('Unable to load profiles') : null}
        isLoading={profiles.status === 'loading'}
        sort={sort}
      />
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
          pageLinks={functions.type === 'resolved' ? functions.data.pageLinks : null}
          onCursor={handleFunctionsCursor}
          size="xs"
        />
      </TableHeader>
      <FunctionsTable
        error={functions.type === 'errored' ? functions.error : null}
        isLoading={functions.type === 'initial' || functions.type === 'loading'}
        functions={functions.type === 'resolved' ? functions.data.functions : []}
        project={props.project}
        sort={functionsSort}
      />
    </Layout.Main>
  );
}

const FIELDS = ['id', 'timestamp', 'release', 'profile.duration'] as const;

type FieldType = typeof FIELDS[number];

const TableHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(1)};
`;

const StyledPagination = styled(Pagination)`
  margin: 0 0 0 ${space(1)};
`;

export {ProfileSummaryContent};
