import {Fragment, useMemo} from 'react';
import {useInfiniteQuery, useQuery} from '@tanstack/react-query';
import {z} from 'zod';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {bulkAutofixAutomationSettingsInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {LoadingError} from 'sentry/components/loadingError';
import {Placeholder} from 'sentry/components/placeholder';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconArrow} from 'sentry/icons/iconArrow';
import {IconBranch} from 'sentry/icons/iconBranch';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {useCompactSelectProjectOptions} from 'sentry/utils/project/useCompactSelectProjectOptions';
import {useProjectsById} from 'sentry/utils/project/useProjectsById';
import {useCompactSelectRepositoryOptions} from 'sentry/utils/repositories/useCompactSelectRepositoryOptions';
import {useRepositoriesById} from 'sentry/utils/repositories/useRepositoriesById';
import {useOrgDefaultAgent} from 'sentry/utils/seer/preferredAgent';
import {getCodingAgentSelectQueryOptions} from 'sentry/utils/seer/preferredAgent';
import {
  PROJECT_STOPPING_POINT_OPTIONS,
  useOrgDefaultStoppingPoint,
} from 'sentry/utils/seer/stoppingPoint';
import {useMutateAutofixProject} from 'sentry/utils/seer/useMutateAutofixProject';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

interface Props extends ModalRenderProps {
  title: string;
  defaultProject?: Project;
}

export function ProjectAddRepoModal({
  Header,
  Body,
  Footer,
  defaultProject,
  title,
  closeModal,
}: Props) {
  const organization = useOrganization();
  const projectsById = useProjectsById();
  const repositoriesById = useRepositoriesById();

  const unconfiguredProjects = useUnconfiguredProjects();
  const projectOptions = useCompactSelectProjectOptions({projects: unconfiguredProjects});
  const repositoryOptions = useCompactSelectRepositoryOptions();
  const agentOptions = useQuery(getCodingAgentSelectQueryOptions({organization}));
  const stoppingPointOptions = PROJECT_STOPPING_POINT_OPTIONS;

  const formSchema = z.object({
    project: z
      .string()
      .refine(id => projectsById.has(id), {
        message: t('Please select a project'),
      })
      .transform(id => projectsById.get(id)!),
    repoEntries: z
      .array(
        z.object({
          repoId: z.string().refine(id => repositoriesById.has(id), {
            message: t('Repository not found'),
          }),
          branch: z.string(),
        })
      )
      .min(1, {message: t('Please add at least one repository')}),
    agent: z.union([z.literal('seer'), z.custom<CodingAgentIntegration>()]),
    stoppingPoint: z.enum(['off', 'root_cause', 'plan', 'create_pr']),
  });

  const saveMutation = useMutateAutofixProject();

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      project: defaultProject?.id ?? '',
      repoEntries: [{repoId: '', branch: ''}],
      agent: useOrgDefaultAgent(),
      stoppingPoint: useOrgDefaultStoppingPoint(),
    },
    validators: {onDynamic: formSchema},
    onSubmit: ({value}) => {
      return saveMutation
        .mutateAsync(formSchema.parse(value), {
          onSuccess: () => {
            addSuccessMessage(t('Project saved successfully'));
            closeModal();
          },
          onError: () => {
            addErrorMessage(t('Failed to save project settings'));
          },
        })
        .catch(() => {});
    },
  });

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h4">{title}</Heading>
      </Header>
      <form.AppForm form={form}>
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
              <form.AppField name="project">
                {field => (
                  <CompactSelect
                    style={{width: '100%'}}
                    trigger={triggerProps => {
                      const project = projectsById.get(field.state.value ?? '');
                      return (
                        <OverlayTrigger.Button {...triggerProps} style={{width: '100%'}}>
                          {project ? (
                            <Flex gap="sm" align="center">
                              <ProjectAvatar project={project} />
                              {project.name}
                            </Flex>
                          ) : (
                            t('Select Project')
                          )}
                        </OverlayTrigger.Button>
                      );
                    }}
                    disabled={Boolean(defaultProject)}
                    emptyMessage={t('No projects found')}
                    onChange={option => field.handleChange(option?.value ?? '')}
                    options={projectOptions}
                    search
                    value={field.state.value ?? ''}
                    virtualizeThreshold={50}
                  />
                )}
              </form.AppField>

              <Flex align="center" height="36px">
                <IconArrow direction="right" size="md" />
              </Flex>

              <Stack gap="md">
                <form.AppField name="repoEntries" mode="array">
                  {field => (
                    <Fragment>
                      {field.state.value.map((_, i) => (
                        <Flex key={`repoEntries[${i}]`} gap="sm" align="start">
                          <Stack gap="xs" flex={1}>
                            <form.Field name={`repoEntries[${i}].repoId`}>
                              {subField => (
                                <CompactSelect
                                  style={{width: '100%'}}
                                  trigger={triggerProps => {
                                    const repo = repositoriesById.get(
                                      subField.state.value
                                    );
                                    return (
                                      <OverlayTrigger.Button
                                        {...triggerProps}
                                        style={{width: '100%'}}
                                      >
                                        {repo ? (
                                          <Flex gap="sm" align="center">
                                            {getIntegrationIcon(
                                              repo.provider?.name?.toLowerCase() || ''
                                            )}
                                            {repo.name}
                                          </Flex>
                                        ) : (
                                          t('Select Repository')
                                        )}
                                      </OverlayTrigger.Button>
                                    );
                                  }}
                                  loading={
                                    repositoryOptions.isPending ||
                                    repositoryOptions.hasNextPage
                                  }
                                  emptyMessage={t('No repositories found')}
                                  onChange={option =>
                                    subField.handleChange(option.value ?? '')
                                  }
                                  options={repositoryOptions.data ?? []}
                                  search
                                  value={subField.state.value ?? ''}
                                  virtualizeThreshold={50}
                                />
                              )}
                            </form.Field>
                            <form.Field key={i} name={`repoEntries[${i}].branch`}>
                              {subField => (
                                <InputGroup>
                                  <InputGroup.LeadingItems disablePointerEvents>
                                    <IconBranch />
                                  </InputGroup.LeadingItems>
                                  <InputGroup.Input
                                    size="sm"
                                    placeholder={t('Select Branch (optional)')}
                                    value={subField.state.value ?? ''}
                                    onChange={e => subField.handleChange(e.target.value)}
                                  />
                                </InputGroup>
                              )}
                            </form.Field>
                          </Stack>
                          {field.state.value.length > 1 && (
                            <Button
                              aria-label={t('Remove repository')}
                              size="sm"
                              variant="transparent"
                              icon={<IconDelete size="xs" />}
                              onClick={() => field.removeValue(i)}
                            />
                          )}
                        </Flex>
                      ))}
                      <Flex>
                        <Button
                          size="sm"
                          variant="transparent"
                          icon={<IconAdd />}
                          onClick={() => field.pushValue({repoId: '', branch: ''})}
                        >
                          {t('Add Repository')}
                        </Button>
                      </Flex>
                    </Fragment>
                  )}
                </form.AppField>
              </Stack>
            </Grid>

            <Separator orientation="horizontal" />

            <form.AppField name="agent">
              {field => (
                <field.Layout.Row
                  label={t('Preferred Coding Agent')}
                  hintText={t(
                    'Seer will always triage and perform Root Cause Analysis for you, but after that you can hand the results to an agent to create a plan, code a fix, and draft a PR.'
                  )}
                >
                  {agentOptions.isPending ? (
                    <Placeholder height="36px" width="100%" />
                  ) : agentOptions.isError ? (
                    <LoadingError />
                  ) : (
                    <field.Select
                      value={field.state.value}
                      onChange={field.handleChange}
                      options={agentOptions.data}
                      isValueEqual={(a, b) =>
                        a === b ||
                        (typeof a === 'object' && typeof b === 'object' && a.id === b.id)
                      }
                    />
                  )}
                </field.Layout.Row>
              )}
            </form.AppField>

            <Separator orientation="horizontal" />

            <form.AppField name="stoppingPoint">
              {field => (
                <field.Layout.Row
                  label={t('Automation Steps')}
                  hintText={t(
                    'Have Autofix trigger on any issue with enough occurrences and Sentry-determined fixability. Select how far you want Autofix to run on actionable issues. The steps are Root Cause Analysis > Plan > Generate Code > Draft PR > Merge PR.'
                  )}
                >
                  <field.Select
                    value={field.state.value}
                    onChange={field.handleChange}
                    options={stoppingPointOptions}
                  />
                </field.Layout.Row>
              )}
            </form.AppField>
          </Stack>
        </Body>
        <Footer>
          <Flex gap="md" justify="end">
            <Button onClick={closeModal}>{t('Cancel')}</Button>
            <form.SubmitButton>{t('Save Project')}</form.SubmitButton>
          </Flex>
        </Footer>
      </form.AppForm>
    </Fragment>
  );
}

function useUnconfiguredProjects() {
  const organization = useOrganization();
  const {projects} = useProjects();

  const autofixSettingsQueryOptions = bulkAutofixAutomationSettingsInfiniteOptions({
    organization,
  });
  const result = useInfiniteQuery({
    ...autofixSettingsQueryOptions,
    select: ({pages}) =>
      Array.from(
        new Set(
          pages
            .flatMap(page => page.json)
            .filter(setting => setting.reposCount > 0)
            .map(setting => String(setting.projectId))
        )
      ),
  });
  useFetchAllPages({result});
  const {data: projectsWithRepos, isPending, hasNextPage} = result;

  return useMemo(() => {
    return isPending || hasNextPage
      ? projects
      : projects.filter(p => !projectsWithRepos?.includes(String(p.id)));
  }, [projects, projectsWithRepos, isPending, hasNextPage]);
}
