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
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {
  makeProjectSeerPreferencesQueryKey,
  useProjectSeerPreferences,
} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
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
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {SEER_THRESHOLD_MAP} from 'sentry/views/settings/projectSeer';
import {SEER_THRESHOLD_OPTIONS} from 'sentry/views/settings/projectSeer/constants';

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
      <ValueWrapper isDangerous={!seerScannerAutomation}>
        <Subheading>{t('Scans:')}</Subheading>{' '}
        {seerScannerAutomation ? t('On') : t('Off')}
      </ValueWrapper>
      <ValueWrapper isDangerous={autofixAutomationTuning === 'off'}>
        <Subheading>{t('Fixes:')}</Subheading>{' '}
        {getSeerLabel(autofixAutomationTuning, seerScannerAutomation)}
      </ValueWrapper>
      <ValueWrapper isDangerous={repoCount === 0}>
        <Subheading>{t('Repos:')}</Subheading> {repoCount}
      </ValueWrapper>
    </SeerValue>
  );
}

const ValueWrapper = styled('span')<{isDangerous?: boolean}>`
  color: ${p => (p.isDangerous ? p.theme.errorText : p.theme.subText)};
`;

const Subheading = styled('span')`
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const SeerDropdownLabel = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
`;

const SeerDropdownDescription = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

function getSeerLabel(key: string, seerScannerAutomation: boolean) {
  if (!seerScannerAutomation) {
    return t('Off');
  }

  const option = SEER_THRESHOLD_OPTIONS.find(opt => opt.value === key);
  return option ? option.label : key;
}

function getSeerDropdownLabel(key: string) {
  const option = SEER_THRESHOLD_OPTIONS.find(opt => opt.value === key);
  if (!option) {
    return (
      <SeerDropdownLabel>
        <div>{key}</div>
        <SeerDropdownDescription />
      </SeerDropdownLabel>
    );
  }

  return (
    <SeerDropdownLabel>
      <div>{option.label}</div>
      <SeerDropdownDescription>{option.details}</SeerDropdownDescription>
    </SeerDropdownLabel>
  );
}

export function SeerAutomationProjectList() {
  const organization = useOrganization();
  const api = useApi({persistInFlight: true});
  const {projects, fetching, fetchError} = useProjects();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const filteredProjects = useMemo(() => {
    return projects.filter(
      project =>
        project.slug.toLowerCase().includes(search.toLowerCase()) &&
        hasEveryAccess(['project:read'], {organization, project})
    );
  }, [projects, search, organization]);

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

  const handleRowClick = (project: Project) => {
    navigate(`/settings/projects/${project.slug}/seer/`);
  };

  const handleCheckboxChange = (projectId: string) => {
    toggleProject(projectId);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click when clicking checkbox
  };

  async function updateProjectsSeerValue(value: string) {
    addLoadingMessage('Updating projects...', {duration: 30000});
    try {
      await Promise.all(
        Array.from(selected).map(projectId => {
          const project = projects.find(p => p.id === projectId);
          if (!project) return Promise.resolve();

          const updateData: any = {autofixAutomationTuning: value};

          // If setting fixes to anything other than "off", also enable scanner
          if (value !== 'off') {
            updateData.seerScannerAutomation = true;
          }

          return api.requestPromise(`/projects/${organization.slug}/${project.slug}/`, {
            method: 'PUT',
            data: updateData,
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

  async function setAllToRecommended() {
    addLoadingMessage('Setting all projects to recommended settings...', {
      duration: 30000,
    });
    try {
      // Get preferences for all filtered projects to check repo counts
      const projectPreferences = await Promise.all(
        filteredProjects.map(async project => {
          try {
            const response = await queryClient.fetchQuery({
              queryKey: [
                makeProjectSeerPreferencesQueryKey(organization.slug, project.slug),
              ],
              queryFn: () =>
                api.requestPromise(
                  makeProjectSeerPreferencesQueryKey(organization.slug, project.slug)
                ),
              staleTime: 60000,
            });
            return {
              project,
              repoCount: response[0].preference?.repositories?.length || 0,
            };
          } catch (err) {
            // If we can't get preferences, assume no repos
            return {
              project,
              repoCount: 0,
            };
          }
        })
      );

      // Update all projects
      await Promise.all(
        projectPreferences.map(({project, repoCount}) => {
          const updateData: any = {};

          if (!project.seerScannerAutomation) {
            updateData.seerScannerAutomation = true; // Set scanner to on for all projects
          }

          // Sets fixes to highly actionable if repos are connected and no automation already set
          if (
            (!project.autofixAutomationTuning ||
              project.autofixAutomationTuning === 'off') &&
            repoCount > 0
          ) {
            updateData.autofixAutomationTuning = 'low';
          }

          // no updates, so don't make a request
          if (Object.keys(updateData).length === 0) {
            return Promise.resolve();
          }

          // make the request
          return api.requestPromise(`/projects/${organization.slug}/${project.slug}/`, {
            method: 'PUT',
            data: updateData,
          });
        })
      );

      const projectsWithNoRepos = projectPreferences.filter(
        ({repoCount}) => repoCount === 0
      ).length;
      const updatedProjectsCount = projectPreferences.length;

      if (projectsWithNoRepos > 0) {
        addSuccessMessage(
          `Settings applied to ${updatedProjectsCount} project(s). ${projectsWithNoRepos} project(s) have no repos connected and were skipped.`
        );
      } else {
        addSuccessMessage(`Settings applied to ${updatedProjectsCount} projects.`);
      }
    } catch (err) {
      addErrorMessage('Failed to update some projects');
    } finally {
      // Invalidate queries for all filtered projects
      filteredProjects.forEach(project => {
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
    label: getSeerDropdownLabel(key),
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
        <SearchBarWrapper>
          <SearchBar
            query={search}
            onChange={handleSearchChange}
            placeholder={t('Search projects')}
          />
        </SearchBarWrapper>
        <Button
          size="sm"
          priority="primary"
          onClick={setAllToRecommended}
          disabled={filteredProjects.length === 0}
          title={t(
            'For all projects, turns Issue Scans on, and if repos are connected, sets Issue Fixes to run automatically.'
          )}
        >
          {t('Turn On for Recommended Projects')}
        </Button>
      </SearchWrapper>
      <Panel>
        <PanelHeader hasButtons>
          <div>{t('Automation for Existing Projects')}</div>
          <Flex gap={space(1)} align="center" style={{marginLeft: 'auto'}}>
            <ActionDropdownMenu
              items={scanMenuItems}
              triggerLabel={t('Set Issue Scans to')}
              size="sm"
              isDisabled={selected.size === 0}
            />
            <ActionDropdownMenu
              items={actionMenuItems}
              triggerLabel={t('Set Issue Fixes to')}
              size="sm"
              isDisabled={selected.size === 0}
            />
            <Button size="sm" onClick={toggleSelectAll}>
              {allFilteredSelected ? t('Unselect All') : t('Select All')}
            </Button>
          </Flex>
        </PanelHeader>
        <PanelBody>
          {filteredProjects.length === 0 && search && (
            <div style={{padding: space(2), textAlign: 'center', color: '#888'}}>
              {t('No projects found matching "%(search)s"', {search})}
            </div>
          )}
          {paginatedProjects.map(project => (
            <ClickablePanelItem key={project.id} onClick={() => handleRowClick(project)}>
              <Flex justify="space-between" align="center" gap={space(2)} flex={1}>
                <Flex gap={space(1)} align="center">
                  <StyledCheckbox
                    checked={selected.has(project.id)}
                    onChange={() => handleCheckboxChange(project.id)}
                    onClick={handleCheckboxClick}
                    aria-label={t('Toggle project')}
                  />
                  <ProjectAvatar project={project} title={project.slug} />
                  <ProjectName>{project.slug}</ProjectName>
                </Flex>
                <ProjectSeerSetting project={project} orgSlug={organization.slug} />
              </Flex>
            </ClickablePanelItem>
          ))}
        </PanelBody>
      </Panel>
      {totalProjects > PROJECTS_PER_PAGE && (
        <Flex justify="flex-end">
          <ButtonBar merged gap="none">
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
  display: flex;
  gap: ${space(2)};
  align-items: center;
`;

const SearchBarWrapper = styled('div')`
  flex: 1;
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
    white-space: normal;
    word-break: break-word;
  }
`;

const StyledCheckbox = styled(Checkbox)`
  margin-bottom: 0;
  padding-bottom: 0;
`;

const ClickablePanelItem = styled(PanelItem)`
  cursor: pointer;
  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const ProjectName = styled('span')`
  font-weight: ${p => p.theme.fontWeight.normal};
`;
