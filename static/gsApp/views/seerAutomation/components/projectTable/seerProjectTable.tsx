import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {debounce, parseAsString, useQueryState} from 'nuqs';

import {InputGroup} from '@sentry/scraps/input/inputGroup';
import {Stack} from '@sentry/scraps/layout/stack';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconSearch} from 'sentry/icons/iconSearch';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {Sort} from 'sentry/utils/discover/fields';
import {ListItemCheckboxProvider} from 'sentry/utils/list/useListItemCheckboxState';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {parseAsSort} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import ProjectTableHeader from 'getsentry/views/seerAutomation/components/projectTable/seerProjectTableHeader';
import SeerProjectTableRow from 'getsentry/views/seerAutomation/components/projectTable/seerProjectTableRow';

export default function SeerProjectTable() {
  const organization = useOrganization();
  const {projects, fetching, fetchError} = useProjects();

  const [searchTerm, setSearchTerm] = useQueryState(
    'query',
    parseAsString.withDefault('')
  );

  const [sort, setSort] = useQueryState(
    'sort',
    parseAsSort.withDefault({field: 'project', kind: 'asc'})
  );

  const queryKey: ApiQueryKey = ['seer-projects', {query: {query: searchTerm}}];

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
        project.name.toLowerCase().includes(lowerCase)
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
      >
        <SimpleTable.Empty>
          <LoadingError />
        </SimpleTable.Empty>
      </ProjectTable>
    );
  }

  return (
    <Fragment>
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
        >
          {filteredProjects.map(project => (
            <SeerProjectTableRow
              key={project.id}
              project={project}
              organization={organization}
            />
          ))}
        </ProjectTable>
      </ListItemCheckboxProvider>
    </Fragment>
  );
}

function ProjectTable({
  children,
  onSortClick,
  projects,
  searchTerm,
  setSearchTerm,
  sort,
}: {
  children: React.ReactNode;
  onSortClick: (sort: Sort) => void;
  projects: Project[];
  searchTerm: string;
  setSearchTerm: ReturnType<typeof useQueryState<string>>[1];
  sort: Sort;
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
        <ProjectTableHeader projects={projects} onSortClick={onSortClick} sort={sort} />
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
