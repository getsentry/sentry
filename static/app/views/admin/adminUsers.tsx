import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import debounce from 'lodash/debounce';
import moment from 'moment-timezone';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Pagination} from '@sentry/scraps/pagination';
import {Text} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SearchBar} from 'sentry/components/searchBar';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {User} from 'sentry/types/user';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

type Status = 'active' | 'disabled';

const STATUS_OPTIONS: Array<{label: string; value: Status}> = [
  {value: 'active', label: t('Active')},
  {value: 'disabled', label: t('Disabled')},
];

export default function AdminUsers() {
  const location = useLocation();
  const navigate = useNavigate();

  const query = decodeScalar(location.query.query, '');
  const status = STATUS_OPTIONS.find(
    option => option.value === decodeScalar(location.query.status)
  )?.value;

  const {data, isPending, isError, refetch} = useQuery({
    ...apiOptions.as<User[]>()('/users/', {
      query: {
        query,
        status,
        sortBy: 'date',
        cursor: decodeScalar(location.query.cursor),
        per_page: 50,
      },
      staleTime: 0,
    }),
    select: selectJsonWithHeaders,
  });

  const users = data?.json;
  const pageLinks = data?.headers.Link;

  const debouncedSearch = useMemo(
    () =>
      debounce(
        (searchQuery: string) =>
          navigate(
            {query: {...location.query, query: searchQuery, cursor: undefined}},
            {replace: true}
          ),
        DEFAULT_DEBOUNCE_DURATION
      ),
    [location.query, navigate]
  );

  return (
    <Fragment>
      <Flex align="center" gap="md" paddingBottom="xl">
        <Container flexGrow={1}>
          {containerProps => (
            <SearchBar
              {...containerProps}
              placeholder={t('Search users')}
              onChange={debouncedSearch}
              query={query}
            />
          )}
        </Container>
        <CompactSelect
          clearable
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} size="sm" prefix={t('Status')}>
              {STATUS_OPTIONS.find(option => option.value === status)?.label ?? t('Any')}
            </OverlayTrigger.Button>
          )}
          value={status}
          options={STATUS_OPTIONS}
          onChange={option =>
            navigate({
              query: {
                ...location.query,
                status: option?.value || undefined,
                cursor: undefined,
              },
            })
          }
        />
      </Flex>

      {isError ? (
        <LoadingError onRetry={refetch} />
      ) : isPending ? (
        <LoadingIndicator />
      ) : (
        <UsersTable>
          <SimpleTable.Header>
            <SimpleTable.HeaderCell>{t('User')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Joined')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Last Login')}</SimpleTable.HeaderCell>
          </SimpleTable.Header>
          {users?.length ? (
            users.map(user => (
              <SimpleTable.Row key={user.id}>
                <SimpleTable.RowCell>
                  <Stack>
                    <Link to={`/manage/users/${user.id}/`}>
                      <Text bold>{user.username}</Text>
                    </Link>
                    {user.email !== user.username && (
                      <Text size="sm" variant="muted">
                        {user.email}
                      </Text>
                    )}
                  </Stack>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  {moment(user.dateJoined).format('ll')}
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  {moment(user.lastLogin).format('ll')}
                </SimpleTable.RowCell>
              </SimpleTable.Row>
            ))
          ) : (
            <SimpleTable.Empty>{t('No users found.')}</SimpleTable.Empty>
          )}
        </UsersTable>
      )}

      {pageLinks && <Pagination pageLinks={pageLinks} />}
    </Fragment>
  );
}

const UsersTable = styled(SimpleTable)`
  grid-template-columns: minmax(0, 1fr) max-content max-content;
`;
