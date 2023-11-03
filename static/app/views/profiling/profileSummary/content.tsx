import {Fragment, useCallback, useMemo} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {CompactSelect} from 'sentry/components/compactSelect';
import * as Layout from 'sentry/components/layouts/thirds';
import Pagination from 'sentry/components/pagination';
import {AggregateFlamegraphPanel} from 'sentry/components/profiling/aggregateFlamegraphPanel';
import {ProfileEventsTable} from 'sentry/components/profiling/profileEventsTable';
import {SuspectFunctionsTable} from 'sentry/components/profiling/suspectFunctions/suspectFunctionsTable';
import {mobile} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PageFilters, Project} from 'sentry/types';
import {useProfileEvents} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {formatSort} from 'sentry/utils/profiling/hooks/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import {ProfilesChart} from 'sentry/views/profiling/landing/profileCharts';

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
    <Fragment>
      <Layout.Main fullWidth>
        <ProfilesChart
          referrer="api.profiling.profile-summary-chart"
          query={props.query}
          hideCount
          compact
        />
        <AggregateFlamegraphPanel transaction={props.transaction} />
        <SuspectFunctionsTable
          project={props.project}
          transaction={props.transaction}
          analyticsPageSource="profiling_transaction"
        />
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
                ? profiles.getResponseHeader?.('Link') ?? null
                : null
            }
            size="xs"
          />
        </TableHeader>
        <ProfileEventsTable
          columns={fields}
          data={profiles.status === 'success' ? profiles.data : null}
          error={profiles.status === 'error' ? t('Unable to load profiles') : null}
          isLoading={profiles.status === 'loading'}
          sort={sort}
        />
      </Layout.Main>
    </Fragment>
  );
}

const ALL_FIELDS = [
  'profile.id',
  'timestamp',
  'release',
  'device.model',
  'device.classification',
  'device.arch',
  'transaction.duration',
  'p75()',
  'p95()',
  'p99()',
  'count()',
  'last_seen()',
] as const;

export type ProfilingFieldType = (typeof ALL_FIELDS)[number];

export function getProfilesTableFields(platform: Project['platform']) {
  if (mobile.includes(platform as any)) {
    return MOBILE_FIELDS;
  }

  return DEFAULT_FIELDS;
}

const MOBILE_FIELDS: ProfilingFieldType[] = [
  'profile.id',
  'timestamp',
  'release',
  'device.model',
  'device.classification',
  'device.arch',
  'transaction.duration',
];
const DEFAULT_FIELDS: ProfilingFieldType[] = [
  'profile.id',
  'timestamp',
  'release',
  'transaction.duration',
];

const FILTER_OPTIONS = [
  {
    label: t('Recent Profiles'),
    value: '-timestamp',
  },
  {
    label: t('Slowest Profiles'),
    value: '-transaction.duration',
  },
  {
    label: t('Fastest Profiles'),
    value: 'transaction.duration',
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
