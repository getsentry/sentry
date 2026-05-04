import {useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {debounce, parseAsString, useQueryState} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {openModal} from 'sentry/actionCreators/modal';
import {
  bulkAutofixAutomationSettingsInfiniteOptions,
  useUpdateBulkAutofixAutomationSettings,
} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {organizationIntegrationsCodingAgents} from 'sentry/components/events/autofix/useAutofix';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconSearch} from 'sentry/icons/iconSearch';
import {t, tct} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {ListItemCheckboxProvider} from 'sentry/utils/list/useListItemCheckboxState';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {getCodingAgentSelectQueryOptions} from 'sentry/utils/seer/preferredAgent';
import {
  getFilteredCodingAgentName,
  type PreferredAgentProvider,
} from 'sentry/utils/seer/preferredAgentFilter';
import {
  preferredAgentFilterParser,
  filterCodingAgentQueryOptions,
} from 'sentry/utils/seer/preferredAgentFilter';
import {
  getProjectStoppingPointMutationOptions,
  getProjectStoppingPointValueFromSettings,
  PROJECT_STOPPING_POINT_SORT_ORDER,
} from 'sentry/utils/seer/stoppingPoint';
import {parseAsSort} from 'sentry/utils/url/parseAsSort';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

import {ProjectTableHeader} from 'getsentry/views/seerAutomation/components/projectTable/seerProjectTableHeader';
import {SeerProjectTableRow} from 'getsentry/views/seerAutomation/components/projectTable/seerProjectTableRow';

export function SeerProjectTable() {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const {projects, fetching, fetchError} = useProjects();

  const [isLoadingModal, setIsLoadingModal] = useState(false);

  const agentOptions = useQuery(getCodingAgentSelectQueryOptions({organization}));
  const codingAgentCompactSelectOptions = useQuery(
    filterCodingAgentQueryOptions({
      organization,
    })
  );

  const autofixSettingsQueryOptions = bulkAutofixAutomationSettingsInfiniteOptions({
    organization,
  });
  const result = useInfiniteQuery({
    ...autofixSettingsQueryOptions,
    select: ({pages}) =>
      Object.fromEntries(
        pages
          .flatMap(page => page.json)
          .map(setting => [String(setting.projectId), setting] as const)
      ),
  });
  useFetchAllPages({result});
  const {data: autofixSettingsByProjectId} = result;

  const {data: integrations, isPending: isPendingIntegrations} = useQuery({
    ...organizationIntegrationsCodingAgents(organization),
    select: data => data.json.integrations ?? [],
  });

  const {mutate: mutateStoppingPoint} = useMutation(
    getProjectStoppingPointMutationOptions({organization, queryClient})
  );

  const {mutate: updateBulkAutofixAutomationSettings} =
    useUpdateBulkAutofixAutomationSettings({
      onSuccess: (_data, variables) => {
        const {projectIds, ...updates} = variables;
        const projectIdSet = new Set(projectIds);

        queryClient.setQueryData(autofixSettingsQueryOptions.queryKey, oldData => {
          if (!oldData) {
            return oldData;
          }
          return {
            ...oldData,
            pages: oldData.pages.map(page => ({
              ...page,
              json: page.json.map(setting =>
                projectIdSet.has(String(setting.projectId))
                  ? {
                      ...setting,
                      ...(updates.autofixAutomationTuning !== undefined && {
                        autofixAutomationTuning: updates.autofixAutomationTuning,
                      }),
                      ...(updates.automatedRunStoppingPoint !== undefined && {
                        automatedRunStoppingPoint: updates.automatedRunStoppingPoint,
                      }),
                    }
                  : setting
              ),
            })),
          };
        });

        for (const projectId of projectIds) {
          if (updates.autofixAutomationTuning !== undefined) {
            ProjectsStore.onUpdateSuccess({
              id: projectId,
              autofixAutomationTuning: updates.autofixAutomationTuning ?? undefined,
            });
          }
        }
      },
    });

  const [agentFilter, setAgentFilter] = useQueryState(
    'agent',
    preferredAgentFilterParser
  );

  const [searchTerm, setSearchTerm] = useQueryState(
    'query',
    parseAsString.withDefault('')
  );

  const [sort, setSort] = useQueryState(
    'sort',
    parseAsSort.withDefault({field: 'project', kind: 'asc'})
  );

  const queryKey = [
    'seer-projects',
    {query: {query: searchTerm, sort, agent: agentFilter}},
  ] as unknown as ApiQueryKey;

  const sortedProjects = useMemo(() => {
    return projects.toSorted((a, b) => {
      if (sort.field === 'project') {
        return sort.kind === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }

      const aSettings = autofixSettingsByProjectId?.[a.id];
      const bSettings = autofixSettingsByProjectId?.[b.id];

      if (sort.field === 'agent') {
        const aAgent = aSettings?.automationHandoff?.target ?? 'seer';
        const bAgent = bSettings?.automationHandoff?.target ?? 'seer';
        return sort.kind === 'asc'
          ? aAgent.localeCompare(bAgent)
          : bAgent.localeCompare(aAgent);
      }

      if (sort.field === 'steps') {
        const aStoppingPointOrder =
          PROJECT_STOPPING_POINT_SORT_ORDER[
            getProjectStoppingPointValueFromSettings(aSettings)
          ];
        const bStoppingPointOrder =
          PROJECT_STOPPING_POINT_SORT_ORDER[
            getProjectStoppingPointValueFromSettings(bSettings)
          ];
        return sort.kind === 'asc'
          ? aStoppingPointOrder - bStoppingPointOrder
          : bStoppingPointOrder - aStoppingPointOrder;
      }

      if (sort.field === 'repo_count') {
        return sort.kind === 'asc'
          ? (aSettings?.reposCount ?? 0) - (bSettings?.reposCount ?? 0)
          : (bSettings?.reposCount ?? 0) - (aSettings?.reposCount ?? 0);
      }

      return 0;
    });
  }, [projects, sort, autofixSettingsByProjectId]);

  const filteredProjects = useMemo(() => {
    let filtered = sortedProjects;

    const lowerCase = searchTerm?.toLowerCase() ?? '';
    if (lowerCase) {
      filtered = filtered.filter(project =>
        project.slug.toLowerCase().includes(lowerCase)
      );
    }

    if (agentFilter) {
      filtered = filtered.filter(project => {
        const settings = autofixSettingsByProjectId?.[project.id];
        const projectAgentId = settings?.automationHandoff?.target
          ? String(settings.automationHandoff.target)
          : 'seer';
        return projectAgentId === agentFilter;
      });
    }

    return filtered;
  }, [sortedProjects, searchTerm, agentFilter, autofixSettingsByProjectId]);

  return (
    <ListItemCheckboxProvider
      hits={filteredProjects.length}
      knownIds={filteredProjects.map(project => project.id)}
      queryKey={queryKey}
    >
      <Stack gap="lg">
        <Flex gap="md">
          {codingAgentCompactSelectOptions.data?.length ? (
            <CompactSelect<'' | PreferredAgentProvider>
              trigger={triggerProps => (
                <OverlayTrigger.Button {...triggerProps} size="md" prefix={t('Agent')}>
                  {agentFilter ? triggerProps.children : t('All')}
                </OverlayTrigger.Button>
              )}
              options={codingAgentCompactSelectOptions.data ?? []}
              onChange={option => setAgentFilter(option.value || null)}
              value={agentFilter ?? ''}
            />
          ) : null}

          <InputGroup style={{width: '100%'}}>
            <InputGroup.LeadingItems disablePointerEvents>
              <IconSearch />
            </InputGroup.LeadingItems>
            <InputGroup.Input
              size="md"
              placeholder={t('Search')}
              value={searchTerm ?? ''}
              onChange={e =>
                setSearchTerm(e.target.value, {limitUrlUpdates: debounce(125)})
              }
            />
          </InputGroup>

          <Button
            variant="primary"
            size="md"
            onClick={async () => {
              setIsLoadingModal(true);
              try {
                const {ProjectAddRepoModal} =
                  await import('getsentry/views/seerAutomation/components/projectAddRepoModal/projectAddRepoModal');

                openModal(
                  deps => (
                    <ProjectAddRepoModal {...deps} title={t('Add Project to Autofix')} />
                  ),
                  {
                    modalCss: css`
                      width: 700px;
                    `,
                  }
                );
              } finally {
                setIsLoadingModal(false);
              }
            }}
            icon={<IconAdd />}
            busy={isLoadingModal}
            disabled={isLoadingModal}
          >
            {t('Add Project')}
          </Button>
        </Flex>
        <SimpleTableWithColumns>
          <ProjectTableHeader
            agentOptions={agentOptions}
            onSortClick={setSort}
            projects={filteredProjects}
            sort={sort}
            updateBulkAutofixAutomationSettings={updateBulkAutofixAutomationSettings}
          />

          {fetching ? (
            <SimpleTable.Empty>
              <LoadingIndicator />
            </SimpleTable.Empty>
          ) : fetchError ? (
            <SimpleTable.Empty>
              <LoadingError />
            </SimpleTable.Empty>
          ) : filteredProjects.length === 0 ? (
            <SimpleTable.Empty>
              {searchTerm
                ? agentFilter
                  ? tct('No projects found matching [searchTerm] with [agentFilter]', {
                      searchTerm: <code>{searchTerm}</code>,
                      agentFilter: <code>{getFilteredCodingAgentName(agentFilter)}</code>,
                    })
                  : tct('No projects found matching [searchTerm]', {
                      searchTerm: <code>{searchTerm}</code>,
                    })
                : agentFilter
                  ? tct('No projects found with [agentFilter]', {
                      agentFilter: <code>{getFilteredCodingAgentName(agentFilter)}</code>,
                    })
                  : t('No projects found')}
            </SimpleTable.Empty>
          ) : (
            filteredProjects.map(project => (
              <SeerProjectTableRow
                key={project.id}
                autofixSettings={autofixSettingsByProjectId?.[project.id]}
                integrations={integrations ?? []}
                isPendingIntegrations={isPendingIntegrations}
                mutateStoppingPoint={mutateStoppingPoint}
                project={project}
                agentOptions={agentOptions}
              />
            ))
          )}
        </SimpleTableWithColumns>
      </Stack>
    </ListItemCheckboxProvider>
  );
}

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: max-content 3fr max-content minmax(240px, 1fr) minmax(200px, 1fr);
  overflow: visible;
`;
