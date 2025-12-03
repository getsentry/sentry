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
import {ListItemCheckboxProvider} from 'sentry/utils/list/useListItemCheckboxState';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import ProjectTableHeader from 'getsentry/views/seerAutomation/components/projectTable/seerProjectTableHeader';
import SeerProjectTableRow from 'getsentry/views/seerAutomation/components/projectTable/seerProjectTableRow';

export default function SeerProjectTable() {
  const organization = useOrganization();
  const {projects, fetching, fetchError} = useProjects();

  const [search] = useQueryState('project', parseAsString);

  const queryKey: ApiQueryKey = ['seer-projects', {query: {query: search}}];

  const filteredProjects = useMemo(() => {
    const searchTerm = search?.toLowerCase() ?? '';
    if (searchTerm) {
      return projects.filter(project => project.name.toLowerCase().includes(searchTerm));
    }
    return projects;
  }, [projects, search]);

  if (fetching) {
    return (
      <ProjectTable projects={filteredProjects}>
        <SimpleTable.Empty>
          <LoadingIndicator />
        </SimpleTable.Empty>
      </ProjectTable>
    );
  }

  if (fetchError) {
    return (
      <ProjectTable projects={filteredProjects}>
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
        <ProjectTable projects={filteredProjects}>
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
  projects,
}: {
  children: React.ReactNode;
  projects: Project[];
}) {
  const [searchTerm, setSearchTerm] = useQueryState(
    'project',
    parseAsString.withDefault('')
  );

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
        <ProjectTableHeader projects={projects} onSortClick={() => {}} sort={undefined} />
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
  grid-template-columns: max-content 1fr repeat(3, max-content);
`;
