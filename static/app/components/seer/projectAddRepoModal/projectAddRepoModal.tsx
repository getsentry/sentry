import {Fragment, useCallback, useEffect} from 'react';
import {useInfiniteQuery, useQuery, type InfiniteData} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {
  defaultFormOptions,
  setFieldErrors,
  useScrapsForm,
  useStore,
} from '@sentry/scraps/form';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {IconArrow} from 'sentry/icons/iconArrow';
import {IconBranch} from 'sentry/icons/iconBranch';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useFetchAllPages, type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {useCompactSelectProjectOptions} from 'sentry/utils/project/useCompactSelectProjectOptions';
import {useProjectsById} from 'sentry/utils/project/useProjectsById';
import {useCompactSelectRepositoryOptions} from 'sentry/utils/repositories/useCompactSelectRepositoryOptions';
import {useRepositoriesById} from 'sentry/utils/repositories/useRepositoriesById';
import {
  NON_GITHUB_HANDOFF_WARNING,
  orgDefaultAgentQueryOptions,
  seerAgentIntegrationsSelectQueryOptions,
} from 'sentry/utils/seer/preferredAgent';
import {isGitHubProvider} from 'sentry/utils/seer/seerProjectRepos';
import {getInfiniteSeerProjectsSettingsQueryOptions} from 'sentry/utils/seer/seerProjectSettings';
import {
  PROJECT_STOPPING_POINT_OPTIONS,
  useOrgDefaultStoppingPoint,
} from 'sentry/utils/seer/stoppingPoint';
import type {
  AutofixAgentSelectOption,
  SeerProjectSettingResponse,
} from 'sentry/utils/seer/types';
import {
  AutofixSettingsPartialSaveError,
  useMutateAutofixProject,
} from 'sentry/utils/seer/useMutateAutofixProject';
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

  const {projects} = useProjects();
  const unconfiguredProjects = useUnconfiguredProjects({projects});
  const projectOptions = useCompactSelectProjectOptions({
    projects: unconfiguredProjects.data ?? projects,
  });
  const repositoryOptions = useCompactSelectRepositoryOptions();
  const {data: agentOptions = []} = useQuery(
    seerAgentIntegrationsSelectQueryOptions({organization})
  );
  const stoppingPointOptions = PROJECT_STOPPING_POINT_OPTIONS;

  const repoEntrySchema = z.object({
    repoId: z
      .string()
      .refine(id => repositoriesById.has(id), {
        message: t('Repository not found'),
      })
      .nonempty(),
    branch: z.string(),
  });
  const formSchema = z.object({
    project: z
      .string()
      .refine(id => projectsById.has(id), {
        message: t('Please select a project'),
      })
      .transform(id => projectsById.get(id)!),
    repoEntries: z
      .array(repoEntrySchema)
      .min(1, {message: t('Please add at least one repository')}),
    agentOption: z.custom<AutofixAgentSelectOption>(),
    stoppingPoint: z.enum(['off', 'root_cause', 'plan', 'create_pr']),
  });

  const saveMutation = useMutateAutofixProject();
  const agentOption =
    useQuery(orgDefaultAgentQueryOptions({organization})).data ?? 'seer';
  const stoppingPoint = useOrgDefaultStoppingPoint();
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      project: defaultProject?.id ?? '',
      repoEntries: [] as Array<{branch: string; repoId: string}>,
      agentOption,
      stoppingPoint,
    },
    validators: {
      onMount: formSchema.extend({
        project: z.string(),
        repoEntries: z.array(repoEntrySchema),
      }),
      onDynamic: formSchema,
    },
    onSubmit: ({value, formApi}) => {
      return saveMutation
        .mutateAsync(formSchema.parse(value), {
          onSuccess: () => {
            addSuccessMessage(t('Project saved successfully'));
            closeModal();
          },
        })
        .catch(error => {
          // Surface failures on the affected fields instead of a toast. The
          // modal stays open so the user can adjust and retry (both writes are
          // idempotent full-replaces).
          if (error instanceof AutofixSettingsPartialSaveError) {
            // Repos already saved; only the settings write failed.
            setFieldErrors(formApi, {
              agentOption: {
                message: t(
                  'Your repositories were saved, but these settings could not be updated. Adjust and try again.'
                ),
              },
              stoppingPoint: {message: t('Could not be saved. Please try again.')},
            });
          } else {
            // The repos write failed first, so nothing was persisted.
            setFieldErrors(formApi, {
              repoEntries: {message: t('Could not save repositories. Please try again.')},
            });
          }
        });
    },
  });

  // Only GitHub repos can hand off to an external coding agent. When any other
  // repo is attached, hard-reset the agent to Seer (rather than just overriding
  // the display) so the user isn't left re-selecting an agent they can't use,
  // and the saved value is correct. Unresolved repos (still loading) are ignored
  // so the dropdown isn't disabled mid-fetch.
  const repoEntries = useStore(form.store, state => state.values.repoEntries);
  const isOnlyGithubRepos = repoEntries.every(entry => {
    const providerId = repositoriesById.get(entry.repoId)?.provider.id;
    // Ignore unresolved repos (still loading) so we don't disable mid-fetch.
    return providerId === undefined || isGitHubProvider(providerId);
  });
  useEffect(() => {
    if (!isOnlyGithubRepos && form.state.values.agentOption !== 'seer') {
      form.setFieldValue('agentOption', 'seer');
    }
  }, [isOnlyGithubRepos, form]);

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
                  manage_repositories_link: (
                    <ExternalLink href={`/settings/${organization.slug}/repos/`} />
                  ),
                }
              )}
            </Text>

            <Separator orientation="horizontal" />

            <Grid columns="minmax(0, 1fr) max-content minmax(0, 1fr)" gap="lg">
              <form.AppField name="project">
                {field => (
                  <Flex minWidth={0}>
                    <Flex gap="sm" align="start" flexGrow={1} minWidth={0}>
                      <CompactSelect
                        style={{width: '100%'}}
                        trigger={triggerProps => {
                          const project = projectsById.get(field.state.value ?? '');
                          return (
                            <OverlayTrigger.Button
                              {...triggerProps}
                              style={{width: '100%', minWidth: 0}}
                            >
                              {project ? (
                                <Flex gap="sm" align="center" minWidth={0}>
                                  <ProjectAvatar project={project} />
                                  <Text ellipsis>{project.name}</Text>
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
                      <field.Meta.Status />
                    </Flex>
                  </Flex>
                )}
              </form.AppField>

              <Flex align="center" height="36px">
                <IconArrow direction="right" size="md" />
              </Flex>

              <Stack gap="xl">
                <form.AppField name="repoEntries" mode="array">
                  {field => (
                    <Fragment>
                      {field.state.value.map((_, i) => (
                        <Flex
                          key={`repoEntries[${i}]`}
                          gap="sm"
                          align="start"
                          minWidth={0}
                        >
                          <Stack gap="xs" flex={1} minWidth={0}>
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
                                        style={{width: '100%', minWidth: 0}}
                                      >
                                        {repo ? (
                                          <Flex gap="sm" align="center" minWidth={0}>
                                            {getIntegrationIcon(
                                              repo.provider.name.toLowerCase() || ''
                                            )}
                                            <Text ellipsis>{repo.name}</Text>
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
                                  onChange={option => subField.handleChange(option.value)}
                                  options={repositoryOptions.data ?? []}
                                  search
                                  value={subField.state.value}
                                  virtualizeThreshold={50}
                                />
                              )}
                            </form.Field>

                            <form.Field name={`repoEntries[${i}].branch`}>
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
                          <Button
                            aria-label={t('Remove repository')}
                            size="sm"
                            variant="transparent"
                            icon={<IconDelete size="xs" />}
                            onClick={() => field.removeValue(i)}
                          />
                        </Flex>
                      ))}
                      <Flex gap="sm" align="center" minWidth={0}>
                        {field.state.value.every(entry => entry.repoId !== '') && (
                          <CompactSelect
                            style={{width: '100%'}}
                            trigger={triggerProps => (
                              <OverlayTrigger.Button
                                {...triggerProps}
                                style={{width: '100%', minWidth: 0}}
                              >
                                {t('Add Repository')}
                              </OverlayTrigger.Button>
                            )}
                            loading={
                              repositoryOptions.isPending || repositoryOptions.hasNextPage
                            }
                            emptyMessage={t('No repositories found')}
                            onChange={option => {
                              field.pushValue({
                                repoId: option.value,
                                branch: '',
                              });
                            }}
                            options={repositoryOptions.data ?? []}
                            search
                            value=""
                            virtualizeThreshold={50}
                          />
                        )}
                        <field.Meta.Status />
                      </Flex>
                    </Fragment>
                  )}
                </form.AppField>
              </Stack>
            </Grid>

            <Separator orientation="horizontal" />

            <Stack gap="md">
              {!isOnlyGithubRepos && (
                <Alert variant="info">{NON_GITHUB_HANDOFF_WARNING}</Alert>
              )}
              <form.AppField name="agentOption">
                {field => (
                  <field.Layout.Row
                    label={t('Handoff to Agent')}
                    hintText={tct(
                      'Seer will always triage and perform Root Cause Analysis for you, but after that you can hand the results to an agent to create a plan, code a fix, and draft a PR. [manage:Manage Coding Agents]',
                      {
                        manage: (
                          <ExternalLink
                            href={`/settings/${organization.slug}/integrations/?category=coding+agent`}
                          />
                        ),
                      }
                    )}
                  >
                    <field.Select
                      value={isOnlyGithubRepos ? field.state.value : 'seer'}
                      onChange={field.handleChange}
                      options={agentOptions}
                      disabled={!isOnlyGithubRepos}
                    />
                  </field.Layout.Row>
                )}
              </form.AppField>
            </Stack>

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

function useUnconfiguredProjects({projects}: {projects: Project[]}) {
  const organization = useOrganization();
  const result = useInfiniteQuery({
    ...getInfiniteSeerProjectsSettingsQueryOptions({
      organization,
      query: {
        per_page: 100,
      },
    }),
    select: useCallback(
      ({pages}: InfiniteData<ApiResponse<SeerProjectSettingResponse[]>>) => {
        const configuredProjects = Array.from(
          new Set(
            pages
              .flatMap(page => page.json)
              .filter(setting => setting.reposCount > 0)
              .map(setting => String(setting.projectId))
          )
        );
        return projects.filter(p => !configuredProjects.includes(String(p.id)));
      },
      [projects]
    ),
  });
  useFetchAllPages({result});
  return result;
}
