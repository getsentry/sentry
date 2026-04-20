import {useMemo} from 'react';
import styled from '@emotion/styled';
import {debounce, parseAsString, useQueryState} from 'nuqs';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {
  bulkAutofixAutomationSettingsInfiniteOptions,
  useUpdateBulkAutofixAutomationSettings,
} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {organizationIntegrationsCodingAgents} from 'sentry/components/events/autofix/useAutofix';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconSearch} from 'sentry/icons/iconSearch';
import {t, tct} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import type {Sort} from 'sentry/utils/discover/fields';
import {ListItemCheckboxProvider} from 'sentry/utils/list/useListItemCheckboxState';
import {useInfiniteQuery, useQuery, useQueryClient} from 'sentry/utils/queryClient';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {
  getFilteredCodingAgentName,
  type PreferredAgentProvider,
} from 'sentry/utils/seer/preferredAgentFilter';
import {
  preferredAgentFilterParser,
  filterCodingAgentQueryOptions,
} from 'sentry/utils/seer/preferredAgentFilter';
import {parseAsSort} from 'sentry/utils/url/parseAsSort';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useFetchAgentOptions} from 'sentry/views/settings/seer/overview/utils/seerPreferredAgent';

import {ProjectTableHeader} from 'getsentry/views/seerAutomation/components/projectTable/seerProjectTableHeader';
import {SeerProjectTableRow} from 'getsentry/views/seerAutomation/components/projectTable/seerProjectTableRow';

export function SeerProjectTable() {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const {projects, fetching, fetchError} = useProjects();

  const agentOptions = useFetchAgentOptions({organization});
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
    select: ({pages}) => pages.flatMap(page => page.json),
  });

  // Auto-fetch each page, one at a time
  useFetchAllPages({result});

  const {data: autofixAutomationSettings} = result;

  const {data: integrations, isPending: isPendingIntegrations} = useQuery({
    ...organizationIntegrationsCodingAgents(organization),
    select: data => data.json.integrations ?? [],
  });

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

  const autofixSettingsByProjectId = useMemo(
    () =>
      new Map(
        (autofixAutomationSettings ?? []).map(setting => [
          String(setting.projectId),
          setting,
        ])
      ),
    [autofixAutomationSettings]
  );

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

      const aSettings = autofixSettingsByProjectId.get(a.id);
      const bSettings = autofixSettingsByProjectId.get(b.id);
      if (sort.field === 'agent') {
        const aAgent = aSettings?.automationHandoff?.target ?? 'seer';
        const bAgent = bSettings?.automationHandoff?.target ?? 'seer';
        return sort.kind === 'asc'
          ? aAgent.localeCompare(bAgent)
          : bAgent.localeCompare(aAgent);
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
        const settings = autofixSettingsByProjectId.get(project.id);
        const projectAgentId = settings?.automationHandoff?.target
          ? String(settings.automationHandoff.target)
          : 'seer';
        return projectAgentId === agentFilter;
      });
    }

    return filtered;
  }, [sortedProjects, searchTerm, agentFilter, autofixSettingsByProjectId]);

  if (fetching) {
    return (
      <ProjectTable
        agentFilter={agentFilter}
        codingAgentCompactSelectOptions={codingAgentCompactSelectOptions.data ?? []}
        projects={filteredProjects}
        onSortClick={setSort}
        setAgentFilter={setAgentFilter}
        sort={sort}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        updateBulkAutofixAutomationSettings={updateBulkAutofixAutomationSettings}
      >
        <SimpleTable.Empty>
          <LoadingIndicator />
        </SimpleTable.Empty>
      </ProjectTable>
    );
  }

  if (fetchError) {
    return (
      <ProjectTable
        agentFilter={agentFilter}
        codingAgentCompactSelectOptions={codingAgentCompactSelectOptions.data ?? []}
        projects={filteredProjects}
        onSortClick={setSort}
        setAgentFilter={setAgentFilter}
        sort={sort}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        updateBulkAutofixAutomationSettings={updateBulkAutofixAutomationSettings}
      >
        <SimpleTable.Empty>
          <LoadingError />
        </SimpleTable.Empty>
      </ProjectTable>
    );
  }

  return (
    <ListItemCheckboxProvider
      hits={filteredProjects.length}
      knownIds={filteredProjects.map(project => project.id)}
      queryKey={queryKey}
    >
      <ProjectTable
        agentFilter={agentFilter}
        codingAgentCompactSelectOptions={codingAgentCompactSelectOptions.data ?? []}
        projects={filteredProjects}
        onSortClick={setSort}
        setAgentFilter={setAgentFilter}
        sort={sort}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        updateBulkAutofixAutomationSettings={updateBulkAutofixAutomationSettings}
      >
        {filteredProjects.length === 0 ? (
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
              autofixSettings={autofixSettingsByProjectId.get(project.id)}
              integrations={integrations ?? []}
              isPendingIntegrations={isPendingIntegrations}
              project={project}
              agentOptions={agentOptions}
            />
          ))
        )}
      </ProjectTable>
    </ListItemCheckboxProvider>
  );
}

function ProjectTable({
  agentFilter,
  codingAgentCompactSelectOptions,
  children,
  onSortClick,
  projects,
  searchTerm,
  setAgentFilter,
  setSearchTerm,
  sort,
  updateBulkAutofixAutomationSettings,
}: {
  agentFilter: null | PreferredAgentProvider;
  children: React.ReactNode;
  codingAgentCompactSelectOptions: Array<{
    label: React.ReactNode;
    value: '' | PreferredAgentProvider;
  }>;
  onSortClick: (sort: Sort) => void;
  projects: Project[];
  searchTerm: string;
  setAgentFilter: ReturnType<typeof useQueryState<PreferredAgentProvider>>[1];
  setSearchTerm: ReturnType<typeof useQueryState<string>>[1];
  sort: Sort;
  updateBulkAutofixAutomationSettings: ReturnType<
    typeof useUpdateBulkAutofixAutomationSettings
  >['mutate'];
}) {
  return (
    <Stack gap="lg">
      <Flex gap="md">
        {codingAgentCompactSelectOptions.length ? (
          <CompactSelect<'' | PreferredAgentProvider>
            trigger={triggerProps => (
              <OverlayTrigger.Button {...triggerProps} size="md" prefix={t('Agent')}>
                {agentFilter ? triggerProps.children : t('All')}
              </OverlayTrigger.Button>
            )}
            options={codingAgentCompactSelectOptions}
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
      </Flex>

      <SimpleTableWithColumns>
        <ProjectTableHeader
          projects={projects}
          onSortClick={onSortClick}
          sort={sort}
          updateBulkAutofixAutomationSettings={updateBulkAutofixAutomationSettings}
        />
        {children}
      </SimpleTableWithColumns>
    </Stack>
  );
}

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: max-content 3fr minmax(300px, 1fr) repeat(2, max-content);
  overflow: visible;
`;
