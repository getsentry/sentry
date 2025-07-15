import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {hasEveryAccess} from 'sentry/components/acl/access';
import ClippedBox from 'sentry/components/clippedBox';
import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {Flex} from 'sentry/components/core/layout';
import {useOrganizationRepositories} from 'sentry/components/events/autofix/preferences/hooks/useOrganizationRepositories';
import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {useUpdateProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconChevron, IconSearch} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {makeDetailedProjectQueryKey} from 'sentry/utils/useDetailedProject';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {AddAutofixRepoModalContent} from 'sentry/views/settings/projectSeer/addAutofixRepoModal';
import {
  MAX_REPOS_LIMIT,
  SEER_THRESHOLD_OPTIONS,
} from 'sentry/views/settings/projectSeer/constants';

type ProjectState = {
  isPending: boolean;
  preference: any;
};

type ProjectStateMap = Record<string, ProjectState>;

// Helper function to transform repositories data
function transformRepositoriesToApiFormat(repositories: any[], repoIds: string[]) {
  const selectedRepos = repositories.filter(repo => repoIds.includes(repo.externalId));

  return selectedRepos.map(repo => {
    const [owner, name] = (repo.name || '/').split('/');
    return {
      provider: repo.provider?.name?.toLowerCase() || '',
      owner: owner || '',
      name: name || repo.name || '',
      external_id: repo.externalId,
      branch_name: '',
      instructions: '',
    };
  });
}

// Helper function to filter projects with access
function filterProjectsWithAccess(projects: Project[], organization: any) {
  return projects.filter(project =>
    hasEveryAccess(['project:read'], {organization, project})
  );
}

function ProjectRow({onClick, project}: {onClick: () => void; project: Project}) {
  return (
    <ClickablePanelItem onClick={onClick}>
      <Flex align="center" gap={space(1)} justify="space-between" flex={1}>
        <Flex align="center" gap={space(1)}>
          <ProjectAvatar project={project} title={project.slug} />
          <ProjectName>{project.slug}</ProjectName>
        </Flex>
        <IconChevron direction="right" size="sm" color="gray300" />
      </Flex>
    </ClickablePanelItem>
  );
}

function ProjectRowWithUpdate({
  isFetchingRepositories,
  onSuccess,
  onUpdateProjectState,
  project,
  projectStates,
  repositories,
}: {
  isFetchingRepositories: boolean;
  onSuccess: (projectId: string) => void;
  onUpdateProjectState: (projectId: string, preference: any) => void;
  project: Project;
  projectStates: ProjectStateMap;
  repositories: any[];
}) {
  const {mutate: updateProjectSeerPreferences} = useUpdateProjectSeerPreferences(project);

  const handleProjectClick = useCallback(() => {
    if (!repositories) return;

    const currentPreference = projectStates[project.id]?.preference;
    const currentRepoIds =
      currentPreference?.repositories?.map((r: any) => r.external_id) || [];

    openModal(deps => (
      <AddAutofixRepoModalContent
        {...deps}
        repositories={repositories}
        selectedRepoIds={currentRepoIds}
        onSave={(repoIds: string[]) => {
          const reposData = transformRepositoriesToApiFormat(repositories, repoIds);

          updateProjectSeerPreferences({repositories: reposData});

          if (reposData.length > 0) {
            addSuccessMessage(
              t('%s repo(s) connected to %s', reposData.length, project.slug)
            );
            onSuccess(project.id);
            onUpdateProjectState(project.id, {
              ...currentPreference,
              repositories: reposData,
            });
          }
        }}
        isFetchingRepositories={isFetchingRepositories}
        maxReposLimit={MAX_REPOS_LIMIT}
      />
    ));
  }, [
    repositories,
    projectStates,
    isFetchingRepositories,
    updateProjectSeerPreferences,
    project.id,
    project.slug,
    onSuccess,
    onUpdateProjectState,
  ]);

  return <ProjectRow onClick={handleProjectClick} project={project} />;
}

function ProjectPreferenceLoader({
  project,
  onUpdate,
}: {
  onUpdate: (project: Project, preference: any, isPending: boolean) => void;
  project: Project;
}) {
  const {preference, isPending} = useProjectSeerPreferences(project);

  useEffect(() => {
    onUpdate(project, preference, isPending);
  }, [project, preference, isPending, onUpdate]);

  return null;
}

function ProjectsWithoutRepos({
  onProjectSuccess,
  onProjectStateUpdate,
  projects,
}: {
  onProjectStateUpdate: (project: Project, preference: any, isPending: boolean) => void;
  onProjectSuccess: (projectId: string) => void;
  projects: Project[];
}) {
  const {data: repositories, isFetching: isFetchingRepositories} =
    useOrganizationRepositories();

  const [projectStates, setProjectStates] = useState<ProjectStateMap>({});
  const [successfullyConnectedProjects, setSuccessfullyConnectedProjects] = useState(
    new Set<string>()
  );
  const [searchQuery, setSearchQuery] = useState('');

  const handleProjectUpdate = useCallback(
    (project: Project, preference: any, isPending: boolean) => {
      setProjectStates(prev => ({
        ...prev,
        [project.id]: {preference, isPending},
      }));
      onProjectStateUpdate(project, preference, isPending);
    },
    [onProjectStateUpdate]
  );

  const handleProjectSuccess = useCallback(
    (projectId: string) => {
      setSuccessfullyConnectedProjects(prev => new Set([...prev, projectId]));
      onProjectSuccess(projectId);
    },
    [onProjectSuccess]
  );

  const handleUpdateProjectState = useCallback(
    (projectId: string, preference: any) => {
      setProjectStates(prev => ({
        ...prev,
        [projectId]: {preference, isPending: false},
      }));
      const project = projects.find(p => p.id === projectId);
      if (project) {
        onProjectStateUpdate(project, preference, false);
      }
    },
    [projects, onProjectStateUpdate]
  );

  const isLoading = useMemo(() => {
    return (
      projects.length === 0 ||
      projects.some(project => projectStates[project.id]?.isPending !== false)
    );
  }, [projects, projectStates]);

  const projectsWithoutRepos = useMemo(() => {
    if (isLoading) return [];

    const filtered = projects.filter(project => {
      if (successfullyConnectedProjects.has(project.id)) return false;

      const state = projectStates[project.id];
      if (!state || state.isPending) return false;

      const repoCount = state.preference?.repositories?.length || 0;
      return repoCount === 0;
    });

    // Apply search filter
    if (!searchQuery.trim()) return filtered;

    const query = searchQuery.toLowerCase();
    return filtered.filter(
      project =>
        project.slug.toLowerCase().includes(query) ||
        project.name?.toLowerCase().includes(query)
    );
  }, [projects, projectStates, isLoading, successfullyConnectedProjects, searchQuery]);

  if (isLoading) {
    return (
      <Panel>
        <PanelHeader>
          <HeaderText>{t('Loading projects...')}</HeaderText>
        </PanelHeader>
        <PanelBody>
          <LoadingState>
            <LoadingIndicator />
          </LoadingState>
        </PanelBody>
        {projects.map(project => (
          <ProjectPreferenceLoader
            key={project.id}
            project={project}
            onUpdate={handleProjectUpdate}
          />
        ))}
      </Panel>
    );
  }

  return (
    <ClippedBox clipHeight={512}>
      <Panel>
        <PanelHeader hasButtons>
          <HeaderText>
            {t('%s Projects missing repositories', projectsWithoutRepos.length)}
          </HeaderText>
          <SearchInputWrapper>
            <InputGroup>
              <InputGroup.LeadingItems>
                <IconSearch size="sm" />
              </InputGroup.LeadingItems>
              <InputGroup.Input
                type="text"
                name="search"
                placeholder={t('Search projects...')}
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSearchQuery(e.target.value)
                }
                size="sm"
              />
            </InputGroup>
          </SearchInputWrapper>
        </PanelHeader>
        <PanelBody>
          {projectsWithoutRepos.map(project => (
            <ProjectRowWithUpdate
              key={project.id}
              project={project}
              repositories={repositories || []}
              isFetchingRepositories={isFetchingRepositories}
              projectStates={projectStates}
              onSuccess={handleProjectSuccess}
              onUpdateProjectState={handleUpdateProjectState}
            />
          ))}
          {projectsWithoutRepos.length === 0 && (
            <EmptyState>{t('All your projects have repositories connected!')}</EmptyState>
          )}
        </PanelBody>
      </Panel>
    </ClippedBox>
  );
}

function ProjectsWithReposTracker({
  projectStates,
  successfullyConnectedProjects,
  onUpdate,
}: {
  onUpdate: (projectsWithRepos: Project[]) => void;
  projectStates: ProjectStateMap;
  successfullyConnectedProjects: Set<string>;
}) {
  const {projects} = useProjects();
  const organization = useOrganization();

  const projectsWithRepos = useMemo(() => {
    const filteredProjects = filterProjectsWithAccess(projects, organization);

    return filteredProjects.filter(project => {
      // Check if project has repositories (either connected this session or previously)
      if (successfullyConnectedProjects.has(project.id)) {
        return true;
      }

      const state = projectStates[project.id];
      if (state && !state.isPending) {
        const repoCount = state.preference?.repositories?.length || 0;
        return repoCount > 0;
      }

      return false;
    });
  }, [projects, projectStates, successfullyConnectedProjects, organization]);

  useEffect(() => {
    onUpdate(projectsWithRepos);
  }, [projectsWithRepos, onUpdate]);

  return null;
}

function SeerAutomationOnboarding() {
  const organization = useOrganization();
  const {projects, fetching} = useProjects();
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedThreshold, setSelectedThreshold] = useState('low');
  const [projectsWithRepos, setProjectsWithRepos] = useState<Project[]>([]);
  const [projectStates, setProjectStates] = useState<ProjectStateMap>({});
  const [successfullyConnectedProjects, setSuccessfullyConnectedProjects] = useState(
    new Set<string>()
  );

  const filteredProjects = useMemo(() => {
    return filterProjectsWithAccess(projects, organization);
  }, [projects, organization]);

  const projectsWithoutRepos = useMemo(() => {
    return filteredProjects.filter(project => {
      // Exclude projects that have been successfully connected this session
      if (successfullyConnectedProjects.has(project.id)) return false;

      // Exclude projects that already have repositories
      const state = projectStates[project.id];
      if (state && !state.isPending) {
        const repoCount = state.preference?.repositories?.length || 0;
        return repoCount === 0;
      }

      // Include projects that are still loading (we don't know their repo status yet)
      return true;
    });
  }, [filteredProjects, successfullyConnectedProjects, projectStates]);

  const handleEnableIssueScans = useCallback(async () => {
    if (projectsWithoutRepos.length === 0) {
      addErrorMessage(t('No remaining projects found to update'));
      return;
    }

    addLoadingMessage(t('Enabling issue scans for remaining projects...'), {
      duration: 30000,
    });

    try {
      await Promise.all(
        projectsWithoutRepos.map(project =>
          api.requestPromise(`/projects/${organization.slug}/${project.slug}/`, {
            method: 'PUT',
            data: {seerScannerAutomation: true},
          })
        )
      );

      addSuccessMessage(
        t('Issue scans enabled for %s remaining project(s)', projectsWithoutRepos.length)
      );

      projectsWithoutRepos.forEach(project => {
        queryClient.invalidateQueries({
          queryKey: makeDetailedProjectQueryKey({
            orgSlug: organization.slug,
            projectSlug: project.slug,
          }),
        });
      });
    } catch (err) {
      addErrorMessage(t('Failed to enable issue scans for some projects'));
    }
  }, [api, organization.slug, projectsWithoutRepos, queryClient]);

  const handleEnableAutoTriggerFixes = useCallback(async () => {
    if (projectsWithRepos.length === 0) {
      addErrorMessage(t('No projects with repositories found to update'));
      return;
    }

    addLoadingMessage(t('Enabling automation for projects with repositories...'), {
      duration: 30000,
    });

    try {
      await Promise.all(
        projectsWithRepos.map(project =>
          api.requestPromise(`/projects/${organization.slug}/${project.slug}/`, {
            method: 'PUT',
            data: {
              autofixAutomationTuning: selectedThreshold,
              seerScannerAutomation: true,
            },
          })
        )
      );

      addSuccessMessage(
        t(
          'Automation enabled for %s project(s) with repositories',
          projectsWithRepos.length
        )
      );

      projectsWithRepos.forEach(project => {
        queryClient.invalidateQueries({
          queryKey: makeDetailedProjectQueryKey({
            orgSlug: organization.slug,
            projectSlug: project.slug,
          }),
        });
      });
    } catch (err) {
      addErrorMessage(t('Failed to enable automation for some projects'));
    }
  }, [api, organization.slug, projectsWithRepos, selectedThreshold, queryClient]);

  const handleProjectStatesUpdate = useCallback(
    (project: Project, preference: any, isPending: boolean) => {
      setProjectStates(prev => ({
        ...prev,
        [project.id]: {preference, isPending},
      }));
    },
    []
  );

  const handleProjectSuccess = useCallback((projectId: string) => {
    setSuccessfullyConnectedProjects(prev => new Set([...prev, projectId]));
  }, []);

  return (
    <Fragment>
      <SentryDocumentTitle
        title={t('Seer Automation Onboarding')}
        orgSlug={organization.slug}
      />
      <SettingsPageHeader
        title={t('Set Up Seer')}
        subtitle={t(
          'Follow these steps to get the most out of Seer across your organization.'
        )}
      />

      <NoProjectMessage organization={organization}>
        <StyledGuidedSteps>
          <GuidedSteps.Step
            stepKey="connect-repos"
            title={t('Connect Your Code')}
            isCompleted={false}
          >
            <StepDescription>
              {t(
                'Give Seer access to the relevant repos for the following projects to enable deeper, more accurate analysis.'
              )}
            </StepDescription>

            {fetching ? (
              <LoadingIndicator />
            ) : (
              <ProjectsWithoutRepos
                projects={filteredProjects.filter(
                  project => !successfullyConnectedProjects.has(project.id)
                )}
                onProjectSuccess={handleProjectSuccess}
                onProjectStateUpdate={handleProjectStatesUpdate}
              />
            )}

            <GuidedSteps.StepButtons />
          </GuidedSteps.Step>

          <GuidedSteps.Step
            stepKey="auto-trigger-fixes"
            title={t('Auto-Trigger Fixes')}
            isCompleted={false}
          >
            <StepDescription>
              {tct(
                "Once Seer scans for the most actionable issues, Seer can trigger a root cause analysis and plan out a solution. This runs in the background, so by the time you get to debugging, the answer is already there. [link:Learn more about Seer automation.][break][break]This setting is only recommended once you've connected repos to a project.",
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/#automation" />
                  ),
                  break: <br />,
                }
              )}
            </StepDescription>

            <AutoFixActionWrapper>
              {projectsWithRepos.length > 0 && (
                <Fragment>
                  <ThresholdSelectorWrapper>
                    <Flex gap={space(1)} align="center">
                      <SelectorLabel>
                        {t('Automatically diagnose issues that are...')}
                      </SelectorLabel>
                      <CompactSelect
                        value={selectedThreshold}
                        onChange={opt => setSelectedThreshold(opt.value)}
                        options={SEER_THRESHOLD_OPTIONS.map(option => ({
                          value: option.value,
                          label: option.label,
                          details: option.details,
                        }))}
                        strategy="fixed"
                      />
                    </Flex>
                  </ThresholdSelectorWrapper>
                  <Button
                    priority="primary"
                    onClick={handleEnableAutoTriggerFixes}
                    disabled={fetching || projectsWithRepos.length === 0}
                  >
                    {t('Enable for %s recommended project(s)', projectsWithRepos.length)}
                  </Button>
                </Fragment>
              )}

              {projectsWithRepos.length === 0 && !fetching && (
                <EmptyProjectsMessage>
                  {t('No projects recommended for auto-triggered fixes')}
                </EmptyProjectsMessage>
              )}
            </AutoFixActionWrapper>

            <GuidedSteps.StepButtons />
          </GuidedSteps.Step>

          <GuidedSteps.Step
            stepKey="enable-issue-scans"
            title={t('Enable Issue Scans')}
            isCompleted={false}
          >
            <StepDescription>
              {tct(
                'For your remaining projects without connected codebases, you can still enable Issue Scans. Seer will scan all new and ongoing issues, flagging the most actionable issues and giving more context in Slack alerts. [link:Learn more about issue scans.]',
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/#issue-scan" />
                  ),
                }
              )}
            </StepDescription>

            <ScanActionWrapper>
              <Button
                priority="primary"
                onClick={handleEnableIssueScans}
                disabled={fetching || projectsWithoutRepos.length === 0}
              >
                {t('Enable for all projects')}
              </Button>
              {projectsWithoutRepos.length === 0 && !fetching && (
                <EmptyProjectsMessage>
                  {t('All projects are set up with Seer!')}
                </EmptyProjectsMessage>
              )}
            </ScanActionWrapper>

            <GuidedSteps.StepButtons />
          </GuidedSteps.Step>

          <GuidedSteps.Step
            stepKey="review-customize"
            title={t('Review and Customize')}
            isCompleted={false}
          >
            <StepDescription>
              {t(
                'You can now visit each project individually to customize Seer more granularly:'
              )}
            </StepDescription>
            <CustomizationList>
              <li>{t('Choose automation thresholds per-project')}</li>
              <li>{t('Set working branches for each repository')}</li>
              <li>{t('Provide context and instructions specific to your codebase')}</li>
              <li>
                {t(
                  'Configure Seer to automatically open pull requests when fixes are ready'
                )}
              </li>
              <li>{t('And more...')}</li>
            </CustomizationList>

            <GuidedSteps.StepButtons>
              <Button
                priority="primary"
                onClick={() => navigate(`/settings/${organization.slug}/seer/`)}
                size="sm"
              >
                {t('Done')}
              </Button>
            </GuidedSteps.StepButtons>
          </GuidedSteps.Step>
        </StyledGuidedSteps>

        {filteredProjects.map(project => (
          <ProjectPreferenceLoader
            key={project.id}
            project={project}
            onUpdate={handleProjectStatesUpdate}
          />
        ))}
        <ProjectsWithReposTracker
          projectStates={projectStates}
          successfullyConnectedProjects={successfullyConnectedProjects}
          onUpdate={setProjectsWithRepos}
        />
      </NoProjectMessage>
    </Fragment>
  );
}

const ProjectName = styled('span')`
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const StepDescription = styled('div')`
  margin-bottom: ${space(2)};
  color: ${p => p.theme.subText};
`;

const HeaderText = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const EmptyState = styled('div')`
  padding: ${space(2)};
  text-align: center;
  color: ${p => p.theme.subText};
`;

const LoadingState = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(1)};
  padding: ${space(3)};
  color: ${p => p.theme.subText};
`;

const StyledGuidedSteps = styled(GuidedSteps)`
  background: none;
`;

const ClickablePanelItem = styled(PanelItem)`
  cursor: pointer;
  transition: background-color 0.1s;
  padding-top: ${space(1)};
  padding-bottom: ${space(1)};

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const ScanActionWrapper = styled('div')`
  margin-bottom: ${space(3)};
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${space(1)};
`;

const EmptyProjectsMessage = styled('div')`
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const AutoFixActionWrapper = styled('div')`
  margin-bottom: ${space(3)};
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${space(2)};
`;

const ThresholdSelectorWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(2)};
  width: 100%;
`;

const SelectorLabel = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const CustomizationList = styled('ul')`
  margin: ${space(2)} 0;
  padding-left: ${space(3)};

  li {
    margin-bottom: ${space(1)};
    color: ${p => p.theme.subText};
  }
`;

const SearchInputWrapper = styled('div')`
  width: 300px;
`;

export default SeerAutomationOnboarding;
