import {useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {debounce, parseAsString, useQueryState} from 'nuqs';

import {InputGroup} from '@sentry/scraps/input/inputGroup';
import {Stack} from '@sentry/scraps/layout/stack';

import {
  useGetBulkAutofixAutomationSettings,
  useUpdateBulkAutofixAutomationSettings,
  type AutofixAutomationSettings,
} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconSearch} from 'sentry/icons/iconSearch';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {Sort} from 'sentry/utils/discover/fields';
import {ListItemCheckboxProvider} from 'sentry/utils/list/useListItemCheckboxState';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {parseAsSort} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import ProjectTableHeader from 'getsentry/views/seerAutomation/components/projectTable/seerProjectTableHeader';
import SeerProjectTableRow from 'getsentry/views/seerAutomation/components/projectTable/seerProjectTableRow';

function getDefaultAutofixSettings(
  organization: Organization,
  projectId: string
): AutofixAutomationSettings {
  return {
    autofixAutomationTuning: organization.defaultAutofixAutomationTuning ?? 'off',
    automatedRunStoppingPoint: organization.autoOpenPrs ? 'open_pr' : 'code_changes',
    projectId,
    reposCount: 0,
  };
}

export default function SeerProjectTable() {
  const organization = useOrganization();
  const {projects, fetching, fetchError} = useProjects();

  const {pages: autofixAutomationSettings, isFetching: isFetchingSettings} =
    useGetBulkAutofixAutomationSettings();

  const [mutationData, setMutations] = useState<
    Record<string, Partial<AutofixAutomationSettings>>
  >({});

  const {mutate: updateBulkAutofixAutomationSettings} =
    useUpdateBulkAutofixAutomationSettings({
      onSuccess: (_data, variables) => {
        const {projectIds, ...rest} = variables;
        setMutations(prev => {
          const updated = {...prev};
          projectIds.forEach(projectId => {
            updated[projectId] = {
              ...prev[projectId],
              ...rest,
            };
          });
          return updated;
        });
      },
    });

  const autofixSettingsByProjectId = useMemo(
    () =>
      new Map(
        autofixAutomationSettings.flatMap(page =>
          page.map(setting => [String(setting.projectId), setting])
        )
      ),
    [autofixAutomationSettings]
  );

  const [searchTerm, setSearchTerm] = useQueryState(
    'query',
    parseAsString.withDefault('')
  );

  const [sort, setSort] = useQueryState(
    'sort',
    parseAsSort.withDefault({field: 'project', kind: 'asc'})
  );

  const queryKey: ApiQueryKey = ['seer-projects', {query: {query: searchTerm, sort}}];

  const sortedProjects = useMemo(() => {
    return projects.toSorted((a, b) => {
      if (sort.field === 'project') {
        return sort.kind === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }

      // TODO: if we can bulk-fetch all the preferences, then it'll be easier to sort by fixes, pr creation, and repos
      // if (sort.field === 'fixes') {
      //   return a.slug.localeCompare(b.slug);
      // }
      // if (sort.field === 'pr_creation') {
      //   return a.platform.localeCompare(b.platform);
      // }
      // if (sort.field === 'repos') {
      //   return a.status.localeCompare(b.status);
      // }
      return 0;
    });
  }, [projects, sort]);

  const filteredProjects = useMemo(() => {
    const lowerCase = searchTerm?.toLowerCase() ?? '';
    if (lowerCase) {
      return sortedProjects.filter(project =>
        project.slug.toLowerCase().includes(lowerCase)
      );
    }
    return sortedProjects;
  }, [sortedProjects, searchTerm]);

  if (fetching) {
    return (
      <ProjectTable
        projects={filteredProjects}
        onSortClick={setSort}
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
        projects={filteredProjects}
        onSortClick={setSort}
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
        projects={filteredProjects}
        onSortClick={setSort}
        sort={sort}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        updateBulkAutofixAutomationSettings={updateBulkAutofixAutomationSettings}
      >
        {filteredProjects.length === 0 ? (
          <SimpleTable.Empty>
            {searchTerm
              ? tct('No projects found matching [searchTerm]', {
                  searchTerm: <code>{searchTerm}</code>,
                })
              : t('No projects found')}
          </SimpleTable.Empty>
        ) : (
          filteredProjects.map(project => (
            <SeerProjectTableRow
              key={project.id}
              project={project}
              isFetchingSettings={isFetchingSettings}
              autofixSettings={{
                ...getDefaultAutofixSettings(organization, project.id),
                ...autofixSettingsByProjectId.get(project.id),
                ...mutationData[project.id],
              }}
              updateBulkAutofixAutomationSettings={updateBulkAutofixAutomationSettings}
            />
          ))
        )}
      </ProjectTable>
    </ListItemCheckboxProvider>
  );
}

function ProjectTable({
  children,
  onSortClick,
  projects,
  searchTerm,
  setSearchTerm,
  sort,
  updateBulkAutofixAutomationSettings,
}: {
  children: React.ReactNode;
  onSortClick: (sort: Sort) => void;
  projects: Project[];
  searchTerm: string;
  setSearchTerm: ReturnType<typeof useQueryState<string>>[1];
  sort: Sort;
  updateBulkAutofixAutomationSettings: ReturnType<
    typeof useUpdateBulkAutofixAutomationSettings
  >['mutate'];
}) {
  return (
    <Stack gap="lg">
      <FiltersContainer>
        <InputGroup>
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
      </FiltersContainer>

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

const FiltersContainer = styled('div')`
  flex-grow: 1;
  min-width: 0;
`;

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: max-content 1fr repeat(4, max-content);
`;
