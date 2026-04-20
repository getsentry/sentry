import {Fragment, useMemo, useState} from 'react';
import {useInfiniteQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Select} from '@sentry/scraps/select';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Placeholder} from 'sentry/components/placeholder';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconArrow} from 'sentry/icons/iconArrow';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t, tct} from 'sentry/locale';
import type {Repository} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {
  organizationRepositoriesInfiniteOptions,
  selectUniqueRepos,
} from 'sentry/utils/repositories/repoQueryOptions';
import {
  useCodingAgentSelectOptions,
  type PreferredAgent,
} from 'sentry/utils/seer/preferredAgent';
import {
  getDefaultStoppingPoint,
  PROJECT_STOPPING_POINT_OPTIONS,
  type UserFacingStoppingPoint,
} from 'sentry/utils/seer/stoppingPoint';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

interface RepoEntry {
  branch: string;
  key: number;
  repoId: Repository['id'] | null;
}

interface Props extends ModalRenderProps {
  title: string;
  preSelectedProject?: Project;
}

let nextKey = 0;
function makeRepoEntry(): RepoEntry {
  return {key: nextKey++, repoId: null, branch: ''};
}

export function ProjectAddRepoModal({
  Header,
  Body,
  Footer,
  preSelectedProject,
  title,
  closeModal,
}: Props) {
  const organization = useOrganization();
  const {projects} = useProjects();

  const projectsById = useMemo(() => {
    return Object.fromEntries(projects.map(project => [project.id, project]));
  }, [projects]);

  const isProjectStatic = Boolean(preSelectedProject);
  const [selectedProjectId, setSelectedProjectId] = useState<Project['id'] | null>(
    preSelectedProject?.id ?? null
  );
  const selectedProject = selectedProjectId ? projectsById[selectedProjectId] : null;

  const [repoEntries, setRepoEntries] = useState<RepoEntry[]>(() => [makeRepoEntry()]);

  const agentOptions = useCodingAgentSelectOptions({organization});
  const integrations = useMemo(
    () =>
      (agentOptions.data ?? [])
        .filter(
          (o): o is {label: string; value: CodingAgentIntegration} => o.value !== 'seer'
        )
        .map(o => o.value),
    [agentOptions.data]
  );

  const [selectedAgent, setSelectedAgent] = useState<PreferredAgent>(() => {
    if (organization.defaultCodingAgentIntegrationId) {
      const match = integrations.find(
        i => i.id === String(organization.defaultCodingAgentIntegrationId)
      );
      if (match) {
        return match;
      }
    }
    return 'seer';
  });
  const [selectedStoppingPoint, setSelectedStoppingPoint] =
    useState<UserFacingStoppingPoint>(() =>
      getDefaultStoppingPoint(organization.defaultAutomatedRunStoppingPoint)
    );

  const hasValidRepo = repoEntries.some(e => e.repoId !== null);
  const isFormValid = selectedProjectId !== null && hasValidRepo;

  const projectOptions = useMemo(() => {
    return projects.map(project => ({
      value: project.id,
      label: project.name,
    }));
  }, [projects]);

  const repositoriesQuery = useInfiniteQuery({
    ...organizationRepositoriesInfiniteOptions({organization, query: {per_page: 100}}),
    select: selectUniqueRepos,
  });
  useFetchAllPages({result: repositoriesQuery});
  const {data: repositories, isPending: isRepositoriesPending} = repositoriesQuery;

  const repositoriesById = useMemo(() => {
    return Object.fromEntries(repositories?.map(repo => [repo.id, repo]) ?? []);
  }, [repositories]);

  const repositoryOptions = useMemo(() => {
    return (
      repositories?.map(repo => ({
        value: repo.id,
        label: repo.name,
      })) ?? []
    );
  }, [repositories]);

  const selectedRepoIds = useMemo(
    () => new Set(repoEntries.map(e => e.repoId).filter(Boolean)),
    [repoEntries]
  );

  const handleRepoChange = (key: number, repoId: Repository['id']) => {
    setRepoEntries(prev =>
      prev.map(entry => (entry.key === key ? {...entry, repoId} : entry))
    );
  };

  const handleBranchChange = (key: number, branch: string) => {
    setRepoEntries(prev =>
      prev.map(entry => (entry.key === key ? {...entry, branch} : entry))
    );
  };

  const handleRemoveEntry = (key: number) => {
    setRepoEntries(prev => prev.filter(entry => entry.key !== key));
  };

  const handleAddEntry = () => {
    setRepoEntries(prev => [...prev, makeRepoEntry()]);
  };

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h4">{title}</Heading>
      </Header>
      <Body>
        <Stack gap="xl">
          <Text size="md">
            {tct(
              "Autofix requires you to attach one or more repositories to your project in order to run. If you don't see the repositories you expect, [manage_repositories_link:manage your repository connections].",
              {
                manage_repositories_link: <Link to="/settings/organization/repos/" />,
              }
            )}
          </Text>
          <Separator orientation="horizontal" />

          <Grid columns="1fr max-content 1fr" gap="xl">
            <CompactSelect
              style={{width: '100%'}}
              trigger={triggerProps => {
                return (
                  <OverlayTrigger.Button {...triggerProps} style={{width: '100%'}}>
                    {selectedProject ? (
                      <ProjectBadge
                        avatarSize={16}
                        project={selectedProject}
                        disableLink
                      />
                    ) : (
                      t('Project')
                    )}
                  </OverlayTrigger.Button>
                );
              }}
              search
              disabled={isProjectStatic}
              emptyMessage={t('No projects found')}
              options={projectOptions}
              value={selectedProjectId ?? ''}
              onChange={option => setSelectedProjectId(option.value)}
            />

            <Flex align="center" height="36px">
              <IconArrow direction="right" size="md" />
            </Flex>
            <Stack gap="md">
              {repoEntries.map(entry => {
                const filteredOptions = repositoryOptions.filter(
                  opt => opt.value === entry.repoId || !selectedRepoIds.has(opt.value)
                );
                const selectedRepo = entry.repoId ? repositoriesById[entry.repoId] : null;

                return (
                  <Flex key={entry.key} gap="sm" align="start">
                    <Stack gap="xs" style={{flex: 1}}>
                      <CompactSelect
                        style={{width: '100%'}}
                        trigger={triggerProps => (
                          <OverlayTrigger.Button
                            {...triggerProps}
                            style={{width: '100%'}}
                          >
                            {selectedRepo?.name ?? t('Repository')}
                          </OverlayTrigger.Button>
                        )}
                        search
                        loading={isRepositoriesPending}
                        emptyMessage={t('No repositories found')}
                        options={filteredOptions}
                        value={entry.repoId ?? ''}
                        onChange={option => handleRepoChange(entry.key, option.value)}
                      />
                      <Input
                        size="sm"
                        placeholder={t('Default branch (e.g. main)')}
                        value={entry.branch}
                        onChange={e => handleBranchChange(entry.key, e.target.value)}
                      />
                    </Stack>
                    {repoEntries.length > 1 && (
                      <Button
                        aria-label={t('Remove repository')}
                        size="sm"
                        priority="transparent"
                        icon={<IconDelete size="xs" />}
                        onClick={() => handleRemoveEntry(entry.key)}
                      />
                    )}
                  </Flex>
                );
              })}

              <Flex>
                <Button
                  size="sm"
                  priority="transparent"
                  icon={<IconAdd />}
                  onClick={handleAddEntry}
                >
                  {t('Add Repository')}
                </Button>
              </Flex>
            </Stack>
          </Grid>

          <Separator orientation="horizontal" />

          <Stack gap="md">
            <Text size="md" bold>
              {t('Preferred Coding Agent')}
            </Text>
            {agentOptions.isPending ? (
              <Placeholder height="36px" width="100%" />
            ) : (
              <Select
                name="agent"
                options={agentOptions.data ?? []}
                value={selectedAgent}
                onChange={option => setSelectedAgent(option.value)}
                isValueEqual={(a, b) =>
                  a === b ||
                  (typeof a === 'object' && typeof b === 'object' && a.id === b.id)
                }
              />
            )}
          </Stack>

          <Stack gap="md">
            <Text size="md" bold>
              {t('Automation Steps')}
            </Text>
            <Select
              name="stoppingPoint"
              options={PROJECT_STOPPING_POINT_OPTIONS}
              value={selectedStoppingPoint}
              onChange={option => setSelectedStoppingPoint(option.value)}
            />
          </Stack>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button priority="primary" disabled={!isFormValid}>
            {t('Save Project')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  );
}
