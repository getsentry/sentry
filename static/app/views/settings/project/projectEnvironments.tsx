import {Fragment, useDeferredValue, useMemo} from 'react';
import styled from '@emotion/styled';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {parseAsInteger, parseAsString, parseAsStringEnum, useQueryStates} from 'nuqs';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex} from '@sentry/scraps/layout';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {LoadingError} from 'sentry/components/loadingError';
import {Placeholder} from 'sentry/components/placeholder';
import {SearchBar} from 'sentry/components/searchBar';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {TagValue} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {DetailedProject} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getDisplayName} from 'sentry/utils/environment';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {fetchMutation} from 'sentry/utils/queryClient';
import {fzf} from 'sentry/utils/search/fzf';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

const ENVIRONMENT_COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: 'minmax(0, 1fr)'},
  {key: 'toggle', width: 'max-content'},
  {key: 'action', width: 'max-content'},
];

interface EnvironmentRowProps {
  name: React.ReactNode;
  children?: React.ReactNode;
  eventCount?: number;
}

interface ProjectEnvironment {
  id: string;
  isHidden: boolean;
  name: string;
}

interface ToggleEnvironmentVariables {
  environment: ProjectEnvironment;
  shouldHide: boolean;
}

const ENVIRONMENTS_PER_PAGE = 100;

function EnvironmentRow({children, eventCount, name}: EnvironmentRowProps) {
  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell minHeight="45px" padding="md xl">
        {name}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end" minHeight="45px" padding="md xl">
        {eventCount ? formatAbbreviatedNumber(eventCount) : null}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end" minHeight="45px" padding="md xl">
        {children}
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

function EnvironmentTableSkeleton({isHidden}: {isHidden: boolean}) {
  return (
    <Fragment>
      {!isHidden && <EnvironmentRow name={t('All Environments')} />}
      {['35%', '28%', '42%', '24%'].map(width => (
        <SimpleTable.Row key={width}>
          <SimpleTable.RowCell minHeight="40px" padding="md xl">
            <Placeholder height="16px" width={width} />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell justify="end" minHeight="40px" padding="md xl">
            <Placeholder height="16px" width="52px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell justify="end" minHeight="40px" padding="md xl">
            <Placeholder height="24px" width="44px" />
          </SimpleTable.RowCell>
        </SimpleTable.Row>
      ))}
    </Fragment>
  );
}

function useEventCounts(organization: Organization, project: DetailedProject) {
  const {data: tagValues = []} = useQuery(
    apiOptions.as<TagValue[]>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/tags/$key/values/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          key: 'environment',
        },
        query: {statsPeriod: '30d'},
        staleTime: 60_000,
      }
    )
  );

  return useMemo(() => {
    const eventCountsByEnvironment = Object.fromEntries(
      tagValues.map(tag => [tag.value, tag.count])
    );
    const eventCountAll = tagValues.reduce((sum, tag) => sum + (tag.count ?? 0), 0);

    return {eventCountsByEnvironment, eventCountAll};
  }, [tagValues]);
}

export default function ProjectEnvironments() {
  const location = useLocation();
  const params = useParams<{projectId: string}>();
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const queryClient = useQueryClient();
  const [{direction, page, query: searchQuery, sort}, setQueryParams] = useQueryStates({
    direction: parseAsStringEnum(['asc', 'desc']).withDefault('asc'),
    page: parseAsInteger.withDefault(1),
    query: parseAsString.withDefault(''),
    sort: parseAsStringEnum(['events', 'name']).withDefault('name'),
  });
  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());

  const isHidden = location.pathname.endsWith('hidden/');
  const visibility = isHidden ? 'hidden' : 'visible';
  const environmentsQueryOptions = apiOptions.as<ProjectEnvironment[]>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/environments/',
    {
      path: {
        organizationIdOrSlug: organization.slug,
        projectIdOrSlug: params.projectId,
      },
      query: {visibility},
      staleTime: 0,
    }
  );
  const {
    data: environments,
    isPending,
    isError,
    refetch,
  } = useQuery(environmentsQueryOptions);

  const toggleEnvironment = useMutation({
    mutationFn: ({environment, shouldHide}: ToggleEnvironmentVariables) =>
      fetchMutation({
        url: getApiUrl(
          '/projects/$organizationIdOrSlug/$projectIdOrSlug/environments/$environment/',
          {
            path: {
              organizationIdOrSlug: organization.slug,
              projectIdOrSlug: params.projectId,
              // Django decodes route params before the endpoint calls
              // `Environment.get_name_from_path_segment()`, which unquotes the value again.
              // Pre-encode here so `getApiUrl`'s normal path-param encoding produces the
              // double-encoded URL needed to preserve literal percent sequences in names.
              environment: encodeURIComponent(environment.name),
            },
          }
        ),
        method: 'PUT',
        data: {isHidden: shouldHide},
      }),
    onMutate: async ({environment}) => {
      await queryClient.cancelQueries({queryKey: environmentsQueryOptions.queryKey});

      const previousData = queryClient.getQueryData(environmentsQueryOptions.queryKey);

      queryClient.setQueryData(environmentsQueryOptions.queryKey, previous =>
        previous
          ? {
              ...previous,
              json: previous.json.filter(env => env.id !== environment.id),
            }
          : previous
      );

      return {previousData};
    },
    onSuccess: (_data, {environment, shouldHide}) => {
      addSuccessMessage(
        shouldHide
          ? t('Hidden %s', getDisplayName(environment))
          : t('Unhidden %s', getDisplayName(environment))
      );
    },
    onError: (_error, {environment, shouldHide}, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(environmentsQueryOptions.queryKey, context.previousData);
      }

      addErrorMessage(
        shouldHide
          ? t('Unable to hide %s', getDisplayName(environment))
          : t('Unable to unhide %s', getDisplayName(environment))
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: environmentsQueryOptions.queryKey});
    },
  });

  const {eventCountsByEnvironment, eventCountAll} = useEventCounts(organization, project);
  const hasWriteAccess = hasEveryAccess(['project:write'], {organization, project});
  const visibleEnvironments = useMemo(() => {
    const matches = deferredSearchQuery
      ? (environments ?? []).filter(
          environment => fzf(environment.name, deferredSearchQuery, false).end !== -1
        )
      : (environments ?? []);

    const multiplier = direction === 'asc' ? 1 : -1;

    return matches.toSorted((left, right) => {
      if (sort === 'events') {
        const countDifference =
          (eventCountsByEnvironment[left.name] ?? 0) -
          (eventCountsByEnvironment[right.name] ?? 0);

        if (countDifference !== 0) {
          return countDifference * multiplier;
        }
      }

      return left.name.localeCompare(right.name) * multiplier;
    });
  }, [deferredSearchQuery, direction, environments, eventCountsByEnvironment, sort]);
  const environmentCount = visibleEnvironments.length;
  const lastPage = Math.max(1, Math.ceil(environmentCount / ENVIRONMENTS_PER_PAGE));
  const currentPage = Math.min(Math.max(page, 1), lastPage);
  const pageStart = (currentPage - 1) * ENVIRONMENTS_PER_PAGE;
  const paginatedEnvironments = visibleEnvironments.slice(
    pageStart,
    pageStart + ENVIRONMENTS_PER_PAGE
  );
  const changePage = (delta: number) => {
    const nextPage = currentPage + delta;
    setQueryParams({page: nextPage === 1 ? null : nextPage}, {history: 'push'});
  };
  const handleSearch = (query: string) => {
    setQueryParams({page: null, query: query || null}, {history: 'replace'});
  };
  const handleSort = (field: 'events' | 'name') => {
    const nextDirection =
      sort === field
        ? direction === 'asc'
          ? 'desc'
          : 'asc'
        : field === 'events'
          ? 'desc'
          : 'asc';
    setQueryParams(
      {direction: nextDirection, page: null, sort: field},
      {history: 'push'}
    );
  };

  return (
    <div>
      <SentryDocumentTitle title={t('Environments')} projectSlug={params.projectId} />
      <SettingsPageHeader title={t('Manage Environments')} />
      <TabsContainer>
        <Tabs value={isHidden ? 'hidden' : 'environments'}>
          <TabList>
            <TabList.Item
              key="environments"
              to={`/settings/${organization.slug}/projects/${params.projectId}/environments/`}
            >
              {t('Environments')}
            </TabList.Item>
            <TabList.Item
              key="hidden"
              to={`/settings/${organization.slug}/projects/${params.projectId}/environments/hidden/`}
            >
              {t('Hidden')}
            </TabList.Item>
          </TabList>
        </Tabs>
      </TabsContainer>
      <ProjectPermissionAlert project={project} />
      <Flex paddingBottom="xl">
        <Container width="100%">
          {containerProps => (
            <SearchBar
              {...containerProps}
              aria-label={t('Search environments')}
              placeholder={t('Search environments')}
              query={searchQuery}
              onChange={handleSearch}
            />
          )}
        </Container>
      </Flex>

      <SimpleTable
        columns={ENVIRONMENT_COLUMNS}
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell
              sort={sort === 'name' ? direction : undefined}
              handleSortClick={() => handleSort('name')}
            >
              {isHidden ? t('Hidden') : t('Active Environments')}
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell
              sort={sort === 'events' ? direction : undefined}
              handleSortClick={() => handleSort('events')}
            >
              <InfoText
                title={t('Count of all error events from the last 30 days')}
                variant="muted"
              >
                {t('Recent Error Events')}
              </InfoText>
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Action')}</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {isPending ? (
          <EnvironmentTableSkeleton isHidden={isHidden} />
        ) : isError ? (
          <SimpleTable.Empty>
            <LoadingError onRetry={refetch} />
          </SimpleTable.Empty>
        ) : visibleEnvironments.length ? (
          <Fragment>
            {currentPage === 1 && !isHidden && !deferredSearchQuery && (
              <EnvironmentRow name={t('All Environments')} eventCount={eventCountAll} />
            )}
            {paginatedEnvironments.map(env => (
              <EnvironmentRow
                key={env.id}
                name={env.name}
                eventCount={eventCountsByEnvironment[env.name]}
              >
                <Button
                  size="xs"
                  disabled={!hasWriteAccess}
                  onClick={() =>
                    toggleEnvironment.mutate({
                      environment: env,
                      shouldHide: !isHidden,
                    })
                  }
                >
                  {isHidden ? t('Show') : t('Hide')}
                </Button>
              </EnvironmentRow>
            ))}
          </Fragment>
        ) : (
          <SimpleTable.Empty>
            {deferredSearchQuery
              ? t('No environments match your search.')
              : isHidden
                ? t("You don't have any hidden environments.")
                : t("You don't have any environments yet.")}
          </SimpleTable.Empty>
        )}
      </SimpleTable>
      {environmentCount > ENVIRONMENTS_PER_PAGE && (
        <Flex justify="end" align="center" gap="xl" margin="2xl 0 0 0">
          <Text variant="muted">
            {tct('[start]-[end] of [total]', {
              start: (pageStart + 1).toLocaleString(),
              end: Math.min(
                pageStart + ENVIRONMENTS_PER_PAGE,
                environmentCount
              ).toLocaleString(),
              total: environmentCount.toLocaleString(),
            })}
          </Text>
          <ButtonBar>
            <Button
              icon={<IconChevron direction="left" />}
              aria-label={t('Previous')}
              size="sm"
              disabled={currentPage === 1}
              onClick={() => changePage(-1)}
            />
            <Button
              icon={<IconChevron direction="right" />}
              aria-label={t('Next')}
              size="sm"
              disabled={currentPage >= lastPage}
              onClick={() => changePage(1)}
            />
          </ButtonBar>
        </Flex>
      )}
    </div>
  );
}

const TabsContainer = styled('div')`
  margin-bottom: ${p => p.theme.space.xl};
`;
