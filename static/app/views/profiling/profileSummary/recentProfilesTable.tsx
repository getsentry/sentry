import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import Pagination from 'sentry/components/pagination';
import {ProfileEventsTable} from 'sentry/components/profiling/profileEventsTable';
import {t} from 'sentry/locale';
import {useProfileEvents} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {formatSort} from 'sentry/utils/profiling/hooks/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

const BASE_FIELDS = [
  'profile.id',
  'trace',
  'trace.transaction',
  'profile.duration',
  'timestamp',
  'release',
  'environment',
  'os.name',
  'os.version',
] as const;

// user misery is only available with the profiling-using-transactions feature
const ALL_FIELDS = [...BASE_FIELDS, 'user_misery()'] as const;
type FieldType = (typeof ALL_FIELDS)[number];

export function RecentProfilesTable() {
  const location = useLocation();
  const organization = useOrganization();

  const profilingUsingTransactions = organization.features.includes(
    'profiling-using-transactions'
  );
  const fields = profilingUsingTransactions ? ALL_FIELDS : BASE_FIELDS;

  const sort = useMemo(() => {
    return formatSort<FieldType>(decodeScalar(location.query.sort), fields, {
      key: 'timestamp',
      order: 'desc',
    });
  }, [location.query.sort, fields]);

  const query = useMemo(() => {
    return decodeScalar(location.query.query, '');
  }, [location.query.query]);

  const profilesCursor = useMemo(
    () => decodeScalar(location.query.cursor),
    [location.query.cursor]
  );

  const profiles = useProfileEvents<FieldType>({
    cursor: profilesCursor,
    fields,
    query,
    sort,
    limit: 20,
    referrer: 'api.profiling.profile-summary-table',
  });

  const eventsTableProps = useMemo(() => {
    return {columns: fields.slice(), sortableColumns: new Set(fields)};
  }, [fields]);

  return (
    <Fragment>
      <ProfileEventsTableContainer>
        <ProfileEventsTable
          sort={sort}
          data={profiles.status === 'success' ? profiles.data : null}
          error={profiles.status === 'error' ? t('Unable to load profiles') : null}
          isLoading={profiles.status === 'loading'}
          {...eventsTableProps}
        />
      </ProfileEventsTableContainer>
      <Pagination pageLinks={profiles.getResponseHeader?.('Link')} />
    </Fragment>
  );
}

const ProfileEventsTableContainer = styled('div')`
  th,
  tr {
    border-radius: 0 !important;
  }

  > div {
    border-radius: 0;
    border-top: none;
  }
`;
