import {useMemo} from 'react';
import styled from '@emotion/styled';

import Pagination from 'sentry/components/pagination';
import {ProfileEventsTable} from 'sentry/components/profiling/profileEventsTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {useProfileEvents} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {formatSort} from 'sentry/utils/profiling/hooks/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';

const FIELDS = [
  'profile.id',
  'timestamp',
  'profile.duration',
  'release',
  'environment',
  'os.name',
  'os.version',
  'trace',
  'trace.transaction',
] as const;

type FieldType = (typeof FIELDS)[number];

export function ProfilesTable() {
  const location = useLocation();

  const sort = useMemo(() => {
    return formatSort<FieldType>(decodeScalar(location.query.sort), FIELDS, {
      key: 'timestamp',
      order: 'desc',
    });
  }, [location.query.sort]);

  const rawQuery = useMemo(() => {
    return decodeScalar(location.query.query, '');
  }, [location.query.query]);

  const query = useMemo(() => {
    const search = new MutableSearch(rawQuery);
    const transaction = decodeScalar(location.query.transaction);

    if (defined(transaction)) {
      search.setFilterValues('transaction', [transaction]);
    }

    return search.formatString();
  }, [rawQuery, location.query.transaction]);

  const profilesCursor = useMemo(
    () => decodeScalar(location.query.cursor),
    [location.query.cursor]
  );

  const profiles = useProfileEvents<FieldType>({
    cursor: profilesCursor,
    fields: FIELDS,
    query,
    sort,
    limit: 20,
    referrer: 'api.profiling.profile-summary-table',
  });

  const eventsTableProps = useMemo(() => {
    return {columns: FIELDS.slice(), sortableColumns: new Set(FIELDS)};
  }, []);

  return (
    <ProfileEvents>
      <ProfileEventsTableContainer>
        <ProfileEventsTable
          sort={sort}
          data={profiles.status === 'success' ? profiles.data : null}
          error={profiles.status === 'error' ? t('Unable to load profiles') : null}
          isLoading={profiles.status === 'loading'}
          {...eventsTableProps}
        />
      </ProfileEventsTableContainer>
      <StyledPagination pageLinks={profiles.getResponseHeader?.('Link')} />
    </ProfileEvents>
  );
}

const ProfileEvents = styled('div')``;
const StyledPagination = styled(Pagination)`
  margin-top: ${space(1)};
  margin-right: ${space(1)};
  margin-bottom: ${space(2)};
`;

const ProfileEventsTableContainer = styled('div')`
  th,
  tr {
    border-radius: 0 !important;
  }

  > div {
    border-radius: 0;
    border-top: none;
    margin-bottom: 0;
  }
`;
