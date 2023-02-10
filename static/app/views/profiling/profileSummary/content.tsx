import {useCallback, useMemo, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {CompactSelect} from 'sentry/components/compactSelect';
import * as Layout from 'sentry/components/layouts/thirds';
import Pagination from 'sentry/components/pagination';
import {FunctionsTable} from 'sentry/components/profiling/functionsTable';
import {ProfileEventsTable} from 'sentry/components/profiling/profileEventsTable';
import {mobile} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {PageFilters, Project} from 'sentry/types';
import {useFunctions} from 'sentry/utils/profiling/hooks/useFunctions';
import {
  formatSort,
  useProfileEvents,
} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {decodeScalar} from 'sentry/utils/queryString';
import {ProfileCharts} from 'sentry/views/profiling/landing/profileCharts';

const FUNCTIONS_CURSOR_NAME = 'functionsCursor';

interface ProfileSummaryContentProps {
  location: Location;
  project: Project;
  query: string;
  selection: PageFilters;
  transaction: string;
}

function ProfileSummaryContent(props: ProfileSummaryContentProps) {
  const fields = useMemo(
    () => getProfilesTableFields(props.project.platform),
    [props.project]
  );

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

  const sort = formatSort<ProfilingFieldType>(
    decodeScalar(props.location.query.sort),
    fields,
    {
      key: 'timestamp',
      order: 'desc',
    }
  );

  const profiles = useProfileEvents<ProfilingFieldType>({
    cursor: profilesCursor,
    fields,
    query: props.query,
    sort,
    limit: 5,
    referrer: 'api.profiling.profile-summary-table',
  });

  const [functionType, setFunctionType] = useState<'application' | 'system' | 'all'>(
    'application'
  );

  const functionsQuery = useFunctions({
    cursor: functionsCursor,
    project: props.project,
    query: '', // TODO: This doesnt support the same filters
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

  const handleFilterChange = useCallback(
    value => {
      browserHistory.push({
        ...props.location,
        query: {...props.location.query, cursor: undefined, sort: value},
      });
    },
    [props.location]
  );

  return (
    <Layout.Main fullWidth>
      <ProfileCharts query={props.query} hideCount />
      <TableHeader>
        <CompactSelect
          triggerProps={{prefix: t('Filter'), size: 'xs'}}
          value={sort.order === 'asc' ? sort.key : `-${sort.key}`}
          options={FILTER_OPTIONS}
          onChange={opt => handleFilterChange(opt.value)}
        />
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
        columns={fields}
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
          pageLinks={
            functionsQuery.isFetched ? functionsQuery.data?.[0]?.pageLinks : null
          }
          onCursor={handleFunctionsCursor}
          size="xs"
        />
      </TableHeader>
      <FunctionsTable
        error={functionsQuery.isError ? functionsQuery.error.message : null}
        isLoading={functionsQuery.isLoading}
        functions={
          functionsQuery.isFetched ? functionsQuery.data?.[0].functions ?? [] : []
        }
        project={props.project}
        sort={functionsSort}
      />
    </Layout.Main>
  );
}

const ALL_FIELDS = [
  'id',
  'timestamp',
  'release',
  'device.model',
  'device.classification',
  'device.arch',
  'profile.duration',
] as const;

export type ProfilingFieldType = (typeof ALL_FIELDS)[number];

export function getProfilesTableFields(platform: Project['platform']) {
  if (mobile.includes(platform as any)) {
    return MOBILE_FIELDS;
  }

  return DEFAULT_FIELDS;
}

const MOBILE_FIELDS: ProfilingFieldType[] = [...ALL_FIELDS];
const DEFAULT_FIELDS: ProfilingFieldType[] = [
  'id',
  'timestamp',
  'release',
  'device.arch',
  'profile.duration',
];

const FILTER_OPTIONS = [
  {
    label: t('Recent Profiles'),
    value: '-timestamp',
  },
  {
    label: t('Slowest Profiles'),
    value: '-profile.duration',
  },
  {
    label: t('Fastest Profiles'),
    value: 'profile.duration',
  },
];

const TableHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(1)};
`;

const StyledPagination = styled(Pagination)`
  margin: 0 0 0 ${space(1)};
`;

export {ProfileSummaryContent};
