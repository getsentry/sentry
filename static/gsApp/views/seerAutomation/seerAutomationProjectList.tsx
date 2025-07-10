import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Checkbox} from 'sentry/components/core/checkbox';
import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import Placeholder from 'sentry/components/placeholder';
import SearchBar from 'sentry/components/searchBar';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {
  makeDetailedProjectQueryKey,
  useDetailedProject,
} from 'sentry/utils/useDetailedProject';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {SEER_THRESHOLD_MAP} from 'sentry/views/settings/projectSeer';

const PROJECTS_PER_PAGE = 20;

function ProjectSeerSetting({project, orgSlug}: {orgSlug: string; project: Project}) {
  const detailedProject = useDetailedProject({
    orgSlug,
    projectSlug: project.slug,
  });

  const {preference, isPending: isLoadingPreferences} =
    useProjectSeerPreferences(project);

  if (detailedProject.isPending || isLoadingPreferences) {
    return (
      <div>
        <Placeholder height="12px" width="50px" />
      </div>
    );
  }

  if (detailedProject.isError) {
    return <div>Error</div>;
  }

  const {autofixAutomationTuning = 'off', seerScannerAutomation = false} =
    detailedProject.data;

  const repoCount = preference?.repositories?.length || 0;

  return (
    <SeerValue>
      <span>
        <Subheading>{t('Scans')}:</Subheading>{' '}
        {seerScannerAutomation ? t('On') : t('Off')}
      </span>
      <span>
        <Subheading>{t('Fixes')}:</Subheading>{' '}
        {getSeerLabel(autofixAutomationTuning, seerScannerAutomation)}
      </span>
      <span>
        <Subheading>{t('Repos')}:</Subheading> {repoCount}
      </span>
    </SeerValue>
  );
}

const Subheading = styled('span')`
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const SeerSelectLabel = styled('div')`
  margin-bottom: ${space(0.5)};
`;

function getSeerLabel(key: string, seerScannerAutomation: boolean) {
  if (!seerScannerAutomation) {
    return t('Off');
  }

  switch (key) {
    case 'off':
      return t('Off');
    case 'super_low':
      return t('Only the Most Actionable Issues');
    case 'low':
      return t('Highly Actionable and Above');
    case 'medium':
      return t('Moderately Actionable and Above');
    case 'high':
      return t('Minimally Actionable and Above');
    case 'always':
      return t('All Issues');
    default:
      return key;
  }
}

export function SeerAutomationProjectList() {
  const organization = useOrganization();
  const api = useApi({persistInFlight: true});
  const {projects, fetching, fetchError} = useProjects();
  const projectsWithWriteAccess = projects.filter(p =>
    hasEveryAccess(['project:write'], {organization, project: p})
  );
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const filteredProjects = useMemo(() => {
    return projects.filter(project =>
      project.slug.toLowerCase().includes(search.toLowerCase())
    );
  }, [projects, search]);

  const handleSearchChange = (searchQuery: string) => {
    setSearch(searchQuery);
    setPage(1); // Reset to first page when search changes
  };

  if (fetching) {
    return <LoadingIndicator />;
  }

  if (fetchError) {
    return <LoadingError />;
  }

  const totalProjects = filteredProjects.length;
  const pageStart = (page - 1) * PROJECTS_PER_PAGE;
  const pageEnd = page * PROJECTS_PER_PAGE;
  const paginatedProjects = filteredProjects.slice(pageStart, pageEnd);

  const previousDisabled = page <= 1;
  const nextDisabled = pageEnd >= totalProjects;

  const goToPrevPage = () => {
    setPage(p => p - 1);
  };

  const goToNextPage = () => {
    setPage(p => p + 1);
  };

  const allFilteredSelected =
    filteredProjects.length > 0 &&
    filteredProjects.every(project => selected.has(project.id));
  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      // Unselect all filtered projects
      setSelected(prev => {
        const newSet = new Set(prev);
        filteredProjects.forEach(project => newSet.delete(project.id));
        return newSet;
      });
    } else {
      // Select all filtered projects
      setSelected(prev => {
        const newSet = new Set(prev);
        filteredProjects.forEach(project => newSet.add(project.id));
        return newSet;
      });
    }
  };

  const toggleProject = (projectId: string) => {
    setSelected(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  async function updateProjectsSeerValue(value: string) {
    addLoadingMessage('Updating projects...', {duration: 30000});
    try {
      await Promise.all(
        Array.from(selected).map(projectId => {
          const project = projects.find(p => p.id === projectId);
          if (!project) return Promise.resolve();
          return api.requestPromise(`/projects/${organization.slug}/${project.slug}/`, {
            method: 'PUT',
            data: {autofixAutomationTuning: value},
          });
        })
      );
      addSuccessMessage('Projects updated successfully');
    } catch (err) {
      addErrorMessage('Failed to update some projects');
    } finally {
      Array.from(selected).forEach(projectId => {
        const project = projects.find(p => p.id === projectId);
        if (!project) return;
        queryClient.invalidateQueries({
          queryKey: makeDetailedProjectQueryKey({
            orgSlug: organization.slug,
            projectSlug: project.slug,
          }),
        });
      });
    }
  }

  async function updateProjectsSeerScanner(value: boolean) {
    addLoadingMessage('Updating projects...', {duration: 30000});
    try {
      await Promise.all(
        Array.from(selected).map(projectId => {
          const project = projects.find(p => p.id === projectId);
          if (!project) return Promise.resolve();
          return api.requestPromise(`/projects/${organization.slug}/${project.slug}/`, {
            method: 'PUT',
            data: {seerScannerAutomation: value},
          });
        })
      );
      addSuccessMessage('Projects updated successfully');
    } catch (err) {
      addErrorMessage('Failed to update some projects');
    } finally {
      Array.from(selected).forEach(projectId => {
        const project = projects.find(p => p.id === projectId);
        if (!project) return;
        queryClient.invalidateQueries({
          queryKey: makeDetailedProjectQueryKey({
            orgSlug: organization.slug,
            projectSlug: project.slug,
          }),
        });
      });
    }
  }

  const actionMenuItems = SEER_THRESHOLD_MAP.map(key => ({
    key,
    label: <SeerSelectLabel>{getSeerLabel(key, true)}</SeerSelectLabel>,
    onAction: () => updateProjectsSeerValue(key),
  }));

  const scanMenuItems = [
    {
      key: 'on',
      label: t('On'),
      onAction: () => updateProjectsSeerScanner(true),
    },
    {
      key: 'off',
      label: t('Off'),
      onAction: () => updateProjectsSeerScanner(false),
    },
  ];

  return (
    <Fragment>
      <SearchWrapper>
        <SearchBar
          query={search}
          onChange={handleSearchChange}
          placeholder={t('Search projects')}
        />
      </SearchWrapper>
      <Panel>
        <PanelHeader hasButtons>
          {selected.size > 0 ? (
            <Flex gap={space(1)} align="center">
              <ActionDropdownMenu
                items={scanMenuItems}
                triggerLabel={t('Set Issue Scans to')}
                size="sm"
              />
              <ActionDropdownMenu
                items={actionMenuItems}
                triggerLabel={t('Set Issue Fixes to')}
                size="sm"
              />
            </Flex>
          ) : (
            <div>{t('Project Level Configs and Overrides')}</div>
          )}
          <div style={{marginLeft: 'auto'}}>
            <Button size="sm" onClick={toggleSelectAll}>
              {allFilteredSelected ? t('Unselect All') : t('Select All')}
            </Button>
          </div>
        </PanelHeader>
        <PanelBody>
          {filteredProjects.length === 0 && search && (
            <div style={{padding: space(2), textAlign: 'center', color: '#888'}}>
              {t('No projects found matching "%(search)s"', {search})}
            </div>
          )}
          {paginatedProjects.map(project => (
            <PanelItem key={project.id}>
              <Flex justify="space-between" align="center" gap={space(2)} flex={1}>
                <Flex gap={space(1)} align="center">
                  <Tooltip
                    title={t('You do not have permission to edit this project')}
                    disabled={projectsWithWriteAccess.includes(project)}
                  >
                    <StyledCheckbox
                      checked={selected.has(project.id)}
                      onChange={() => toggleProject(project.id)}
                      aria-label={t('Toggle project')}
                      disabled={!projectsWithWriteAccess.includes(project)}
                    />
                  </Tooltip>
                  <ProjectAvatar project={project} title={project.slug} />
                  <Link
                    to={`/settings/${organization.slug}/projects/${project.slug}/seer/`}
                  >
                    {project.slug}
                  </Link>
                </Flex>
                <ProjectSeerSetting project={project} orgSlug={organization.slug} />
              </Flex>
            </PanelItem>
          ))}
        </PanelBody>
      </Panel>
      {totalProjects > PROJECTS_PER_PAGE && (
        <Flex justify="flex-end">
          <ButtonBar merged>
            <Button
              icon={<IconChevron direction="left" />}
              aria-label={t('Previous')}
              size="sm"
              disabled={previousDisabled}
              onClick={goToPrevPage}
            />
            <Button
              icon={<IconChevron direction="right" />}
              aria-label={t('Next')}
              size="sm"
              disabled={nextDisabled}
              onClick={goToNextPage}
            />
          </ButtonBar>
        </Flex>
      )}
    </Fragment>
  );
}

const SearchWrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const SeerValue = styled('div')`
  color: ${p => p.theme.subText};
  display: flex;
  justify-content: flex-end;
  gap: ${space(4)};
`;

const ActionDropdownMenu = styled(DropdownMenu)`
  [data-test-id='menu-list-item-label'] {
    font-weight: normal;
    text-transform: none;
  }
`;

const StyledCheckbox = styled(Checkbox)`
  margin-bottom: 0;
  padding-bottom: 0;
  padding-top: ${space(0.5)};
`;
