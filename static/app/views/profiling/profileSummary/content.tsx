import {Fragment, useCallback, useMemo, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {SectionHeading} from 'sentry/components/charts/styles';
import CompactSelect from 'sentry/components/forms/compactSelect';
import * as Layout from 'sentry/components/layouts/thirds';
import Pagination from 'sentry/components/pagination';
import {FunctionsTable} from 'sentry/components/profiling/functionsTable';
import {LegacyFunctionsTable} from 'sentry/components/profiling/legacyFunctionsTable';
import {ProfilesTable} from 'sentry/components/profiling/profilesTable';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {PageFilters, Project} from 'sentry/types';
import {
  isFunctionsResultV1,
  isFunctionsResultV2,
  useFunctions,
} from 'sentry/utils/profiling/hooks/useFunctions';
import {useProfiles} from 'sentry/utils/profiling/hooks/useProfiles';
import {decodeScalar} from 'sentry/utils/queryString';

const FUNCTIONS_CURSOR_NAME = 'functionsCursor';

const PROFILES_COLUMN_ORDER = [
  'failed',
  'id',
  'timestamp',
  'version_name',
  'device_model',
  'device_classification',
  'trace_duration_ms',
] as const;

interface ProfileSummaryContentProps {
  location: Location;
  project: Project;
  query: string;
  transaction: string;
  selection?: PageFilters;
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

  const profiles = useProfiles({
    cursor: profilesCursor,
    limit: 5,
    query: props.query,
    selection: props.selection,
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
          pageLinks={profiles.type === 'resolved' ? profiles.data.pageLinks : null}
          size="xs"
        />
      </TableHeader>
      <ProfilesTable
        error={profiles.type === 'errored' ? profiles.error : null}
        isLoading={profiles.type === 'initial' || profiles.type === 'loading'}
        traces={profiles.type === 'resolved' ? profiles.data.traces : []}
        columnOrder={PROFILES_COLUMN_ORDER}
      />
      {functions.type === 'resolved' && isFunctionsResultV1(functions.data) ? (
        // this does result in some flickering if we get the v1 results
        // back but this is temporary and will be removed in the near future
        <LegacyFunctionsTable
          error={null}
          functionCalls={functions.data.functions}
          isLoading={false}
          project={props.project}
        />
      ) : (
        <Fragment>
          <TableHeader>
            <CompactSelect
              triggerProps={{prefix: t('Suspect Functions'), size: 'xs'}}
              value={functionType}
              options={[
                {
                  label: t('All'),
                  value: 'all',
                },
                {
                  label: t('Application'),
                  value: 'application',
                },
                {
                  label: t('System'),
                  value: 'system',
                },
              ]}
              onChange={({value}) => setFunctionType(value)}
            />
            <StyledPagination
              pageLinks={
                functions.type === 'resolved' && isFunctionsResultV2(functions.data)
                  ? functions.data.pageLinks
                  : null
              }
              onCursor={handleFunctionsCursor}
              size="xs"
            />
          </TableHeader>
          <FunctionsTable
            error={functions.type === 'errored' ? functions.error : null}
            isLoading={functions.type === 'initial' || functions.type === 'loading'}
            functions={
              functions.type === 'resolved' && isFunctionsResultV2(functions.data)
                ? functions.data.functions
                : []
            }
            project={props.project}
            sort={functionsSort}
          />
        </Fragment>
      )}
    </Layout.Main>
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

export {ProfileSummaryContent};
