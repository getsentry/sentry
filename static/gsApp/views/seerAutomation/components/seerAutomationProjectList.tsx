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
import {
  makeDetailedProjectQueryKey,
  useDetailedProject,
} from 'sentry/utils/project/useDetailedProject';
import {useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
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

  const {
    preference,
    isPending: isLoadingPreferences,
    codeMappingRepos,
  } = useProjectSeerPreferences(project);

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

  let repoCount = preference?.repositories?.length || 0;
  if (repoCount === 0 && codeMappingRepos) {
    repoCount = codeMappingRepos.length;
  }

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
  color: ${p => (p.isDangerous ? p.theme.tokens.content.danger : p.theme.subText)};
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
    navigate(`/settings/${organization.slug}/projects/${project.slug}/seer/`);
  };

  const handleCheckboxChange = (projectId: string) => {
    toggleProject(projectId);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click when clicking checkbox
  };

  async function updateProjectsSeerValue(value: string) {
    addLoadingMessage('Updating projects...', {duration: 60000});
    try {
      // Process projects in batches to avoid concurrency limit
      const batchSize = 20;
      const selectedProjects = Array.from(selected);

      for (let i = 0; i < selectedProjects.length; i += batchSize) {
        const batch = selectedProjects.slice(i, i + batchSize);
        await Promise.all(
          batch.map(projectId => {
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
      }
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
    addLoadingMessage('Updating projects...', {duration: 60000});
    try {
      // Process projects in batches to avoid concurrency limit
      const batchSize = 20;
      const selectedProjects = Array.from(selected);

      for (let i = 0; i < selectedProjects.length; i += batchSize) {
        const batch = selectedProjects.slice(i, i + batchSize);
        await Promise.all(
          batch.map(projectId => {
            const project = projects.find(p => p.id === projectId);
            if (!project) return Promise.resolve();
            return api.requestPromise(`/projects/${organization.slug}/${project.slug}/`, {
              method: 'PUT',
              data: {seerScannerAutomation: value},
            });
          })
        );
      }
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
          size="md"
          priority="primary"
          onClick={() => navigate(`/settings/${organization.slug}/seer/onboarding`)}
        >
          {t('Open Setup Wizard')}
        </Button>
      </SearchWrapper>
      <Panel>
        <PanelHeader hasButtons>
          <div>{t('Automation for Existing Projects')}</div>
          <Flex gap="md" align="center" marginLeft="auto">
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
              <Flex justify="between" align="center" gap="xl" flex={1}>
                <Flex gap="md" align="center">
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
        <Flex justify="end">
          <ButtonBar merged gap="0">
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
