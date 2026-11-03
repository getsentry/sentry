import {useQuery} from '@tanstack/react-query';
import moment from 'moment-timezone';
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
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {BreadcrumbTitle} from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle';

type Row = {
  dateCreated: string;
  id: string;
  name: string;
  organization: {
    name: string;
    slug: string;
  };
  slug: string;
  status: string;
};

const COLUMNS: TableColumnConfig[] = [
  {key: 'project', width: 'minmax(0, 1fr)'},
  {key: 'status', width: '150px'},
  {key: 'created', width: '200px'},
];

const STATUS_OPTIONS = [
  {value: 'active', label: t('Active')},
  {value: 'deleted', label: t('Deleted')},
] as const;

const STATUS_VALUES = STATUS_OPTIONS.map(option => option.value);

export default function AdminProjects() {
  const [{query, status, cursor}, setSearchParams] = useQueryStates({
    query: parseAsString.withDefault(''),
    status: parseAsStringLiteral(STATUS_VALUES),
    cursor: parseAsString,
  });

  const {data, isPending, isError, refetch} = useQuery({
    ...apiOptions.as<Row[]>()('/projects/', {
      query: {
        show: 'all',
        query,
        status: status ?? undefined,
        sortBy: 'date',
        cursor: cursor ?? undefined,
      },
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
      <BreadcrumbTitle title={t('Projects')} />
      <Flex align="center" gap="md" wrap="wrap">
        <Container flexGrow={1} minWidth="240px">
          {containerProps => (
            <SearchBar
              {...containerProps}
              placeholder={t('Search projects')}
              onChange={onSearch}
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
          value={status ?? undefined}
          options={[...STATUS_OPTIONS]}
          onChange={option =>
            setSearchParams(
              {status: option?.value ?? null, cursor: null},
              {history: 'push'}
            )
          }
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
              <SimpleTable.HeaderCell>{t('Project')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Status')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Created')}</SimpleTable.HeaderCell>
            </SimpleTable.HeaderRow>
          }
        >
          {data.json.length ? (
            data.json.map(project => (
              <SimpleTable.Row key={project.id}>
                <SimpleTable.RowCell>
                  <Stack>
                    <Link to={`/${project.organization.slug}/${project.slug}/`}>
                      <Text bold variant="accent">
                        {project.name}
                      </Text>
                    </Link>
                    <Text size="sm" variant="muted">
                      {project.organization.name}
                    </Text>
                  </Stack>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>{project.status}</SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  {moment(project.dateCreated).format('ll')}
                </SimpleTable.RowCell>
              </SimpleTable.Row>
            ))
          ) : (
            <SimpleTable.Empty>{t('No projects found.')}</SimpleTable.Empty>
          )}
        </SimpleTable>
      )}

      {data?.headers.Link && <Pagination pageLinks={data.headers.Link} />}
    </Stack>
  );
}
