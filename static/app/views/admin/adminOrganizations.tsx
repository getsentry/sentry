import {useQuery} from '@tanstack/react-query';
import {debounce, parseAsString, parseAsStringLiteral, useQueryStates} from 'nuqs';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Pagination} from '@sentry/scraps/pagination';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SearchBar} from 'sentry/components/searchBar';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {OrganizationSummary} from 'sentry/types/organization';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {BreadcrumbTitle} from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle';

const COLUMNS: TableColumnConfig[] = [{key: 'organization', width: 'minmax(0, 1fr)'}];

const SORT_OPTIONS = [
  {value: 'date', label: t('Date Joined')},
  {value: 'members', label: t('Members')},
  {value: 'events', label: t('Events')},
  {value: 'projects', label: t('Projects')},
  {value: 'employees', label: t('Employees')},
] as const;

const SORT_VALUES = SORT_OPTIONS.map(option => option.value);

export default function AdminOrganizations() {
  const [{query, sortBy, cursor}, setSearchParams] = useQueryStates({
    query: parseAsString.withDefault(''),
    sortBy: parseAsStringLiteral(SORT_VALUES).withDefault('date'),
    cursor: parseAsString,
  });

  const {data, isPending, isError, refetch} = useQuery({
    ...apiOptions.as<OrganizationSummary[]>()('/organizations/', {
      query: {show: 'all', query, sortBy, cursor: cursor ?? undefined},
      staleTime: 0,
    }),
    select: selectJsonWithHeaders,
  });

  const onSearch = (searchQuery: string) =>
    setSearchParams(
      {query: searchQuery, cursor: null},
      {limitUrlUpdates: debounce(DEFAULT_DEBOUNCE_DURATION), history: 'replace'}
    );

  return (
    <Stack gap="xl">
      <BreadcrumbTitle title={t('Organizations')} />
      <Flex align="center" gap="md" wrap="wrap">
        <Container flexGrow={1} minWidth="240px">
          {containerProps => (
            <SearchBar
              {...containerProps}
              placeholder={t('Search organizations')}
              onChange={onSearch}
              query={query}
            />
          )}
        </Container>
        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} size="sm" prefix={t('Sort By')}>
              {SORT_OPTIONS.find(option => option.value === sortBy)?.label ??
                t('Date Joined')}
            </OverlayTrigger.Button>
          )}
          value={sortBy}
          options={[...SORT_OPTIONS]}
          onChange={option => setSearchParams({sortBy: option.value, cursor: null})}
        />
      </Flex>

      {isError ? (
        <LoadingError onRetry={refetch} />
      ) : isPending ? (
        <LoadingIndicator />
      ) : (
        <SimpleTable
          columns={COLUMNS}
          header={
            <SimpleTable.HeaderRow>
              <SimpleTable.HeaderCell>{t('Organization')}</SimpleTable.HeaderCell>
            </SimpleTable.HeaderRow>
          }
        >
          {data.json.length ? (
            data.json.map(organization => (
              <SimpleTable.Row key={organization.id}>
                <SimpleTable.RowCell>
                  <Stack>
                    <Link to={`/${organization.slug}/`}>
                      <Text bold variant="accent">
                        {organization.name}
                      </Text>
                    </Link>
                    <Text size="sm" variant="muted">
                      {organization.slug}
                    </Text>
                  </Stack>
                </SimpleTable.RowCell>
              </SimpleTable.Row>
            ))
          ) : (
            <SimpleTable.Empty>{t('No organizations found.')}</SimpleTable.Empty>
          )}
        </SimpleTable>
      )}

      {data?.headers.Link && <Pagination pageLinks={data.headers.Link} />}
    </Stack>
  );
}
