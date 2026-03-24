import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Badge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {IdBadge} from 'sentry/components/idBadge';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useScmIntegrationTreeData} from 'sentry/components/repositories/scmIntegrationTree/useScmIntegrationTreeData';
import {IconAdd, IconDelete, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {
  IntegrationRepository,
  OrganizationIntegration,
  Repository,
  RepositoryProjectPathConfig,
} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {
  fetchMutation,
  useApiQuery,
  useMutation,
  useQueryClient as useQueryClientHook,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

// ─────────────────────────────────────────────────────────────
// Queries / mutations
// ─────────────────────────────────────────────────────────────

function makeCodeMappingsQueryKey({orgSlug}: {orgSlug: string}): ApiQueryKey {
  return [
    getApiUrl(`/organizations/$organizationIdOrSlug/code-mappings/`, {
      path: {organizationIdOrSlug: orgSlug},
    }),
  ];
}

const integrationReposOptions = (
  orgSlug: string,
  integrationId: string,
  search: string
) =>
  apiOptions.as<{repos: IntegrationRepository[]}>()(
    '/organizations/$organizationIdOrSlug/integrations/$integrationId/repos/',
    {
      path: {organizationIdOrSlug: orgSlug, integrationId},
      query: {search},
      staleTime: 1000 * 60 * 5,
    }
  );

function useDeletePathConfig() {
  const api = useApi({persistInFlight: false});
  const organization = useOrganization();
  const queryClient = useQueryClientHook();
  return useMutation<
    RepositoryProjectPathConfig,
    RequestError,
    RepositoryProjectPathConfig
  >({
    mutationFn: pathConfig => {
      return api.requestPromise(
        `/organizations/${organization.slug}/code-mappings/${pathConfig.id}/`,
        {method: 'DELETE'}
      );
    },
    onSuccess: () => {
      addSuccessMessage(t('Successfully deleted code mapping'));
    },
    onError: error => {
      addErrorMessage(`${error.statusText}: ${error.responseText}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${organization.slug}/code-mappings/`],
      });
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export function AllCodeMappings() {
  const organization = useOrganization();
  const {projects} = useProjects();

  const {scmIntegrations} = useScmIntegrationTreeData();

  const {data: activeRepos = []} = useApiQuery<Repository[]>(
    [
      getApiUrl(`/organizations/$organizationIdOrSlug/repos/`, {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {query: {status: 'active'}},
    ],
    {staleTime: 10_000}
  );

  const scmRepos = useMemo(
    () => activeRepos.filter(r => scmIntegrations.some(i => i.id === r.integrationId)),
    [activeRepos, scmIntegrations]
  );

  const {
    data: codeMappings = [],
    isPending,
    isError,
  } = useApiQuery<RepositoryProjectPathConfig[]>(
    makeCodeMappingsQueryKey({orgSlug: organization.slug}),
    {staleTime: 10_000}
  );

  const invalidateCodeMappings = useCallback(() => {
    // We don't use queryClient here directly — the modal handles its own invalidation
  }, []);

  const openProjectMappingsModal = useCallback(
    (project: Project) => {
      openModal(
        modalProps => (
          <ProjectCodeMappingsModal
            {...modalProps}
            project={project}
            mappings={codeMappings.filter(m => m.projectId === project.id)}
            integrations={scmIntegrations}
            repos={scmRepos}
          />
        ),
        {onClose: invalidateCodeMappings}
      );
    },
    [codeMappings, scmIntegrations, scmRepos, invalidateCodeMappings]
  );

  // Group code mappings by project
  const mappingsByProject = useMemo(() => {
    const map = new Map<string, RepositoryProjectPathConfig[]>();
    for (const mapping of codeMappings) {
      const existing = map.get(mapping.projectId) ?? [];
      existing.push(mapping);
      map.set(mapping.projectId, existing);
    }
    return map;
  }, [codeMappings]);

  const projectsWithMappings = useMemo(
    () => projects.filter(p => mappingsByProject.has(p.id)),
    [projects, mappingsByProject]
  );
  const projectsWithoutMappings = useMemo(
    () => projects.filter(p => !mappingsByProject.has(p.id)),
    [projects, mappingsByProject]
  );

  const hasAccess = hasEveryAccess(['org:integrations'], {organization});

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError message={t('Error loading code mappings')} />;
  }

  return (
    <Stack gap="md">
      <Stack gap="xs">
        <Text bold size="xl">
          {t('Code mapping')}
        </Text>
        {projectsWithoutMappings.length > 0 && (
          <Text variant="muted" size="sm">
            {t(
              '%s projects with no repository connected',
              projectsWithoutMappings.length
            )}
          </Text>
        )}
      </Stack>

      <div>
        {projectsWithMappings.map(project => (
          <ProjectRow
            key={project.id}
            project={project}
            mappings={mappingsByProject.get(project.id) ?? []}
            hasAccess={hasAccess}
            onEdit={() => openProjectMappingsModal(project)}
          />
        ))}
        {projectsWithoutMappings.map(project => (
          <ProjectRow
            key={project.id}
            project={project}
            mappings={[]}
            hasAccess={hasAccess}
            onEdit={() => openProjectMappingsModal(project)}
          />
        ))}
      </div>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────
// Project row
// ─────────────────────────────────────────────────────────────

function ProjectRow({
  project,
  mappings,
  hasAccess,
  onEdit,
}: {
  hasAccess: boolean;
  mappings: RepositoryProjectPathConfig[];
  onEdit: () => void;
  project: Project;
}) {
  const hasMappings = mappings.length > 0;

  return (
    <ProjectRowContainer>
      <Flex align="center" gap="md" flex={1}>
        <IdBadge
          project={project}
          avatarSize={20}
          avatarProps={{consistentWidth: true}}
        />
        {hasMappings ? (
          <Flex align="center" gap="sm">
            {mappings.map(mapping => (
              <Badge key={mapping.id} variant="muted">
                {mapping.repoName}
              </Badge>
            ))}
          </Flex>
        ) : (
          <Text size="xs" variant="muted">
            {t('No code mapping')}
          </Text>
        )}
      </Flex>
      <Button
        size="xs"
        priority="transparent"
        aria-label={t('Edit code mappings for %s', project.slug)}
        icon={<IconEdit size="xs" />}
        disabled={!hasAccess}
        onClick={onEdit}
      />
    </ProjectRowContainer>
  );
}

// ─────────────────────────────────────────────────────────────
// Project code mappings modal
// ─────────────────────────────────────────────────────────────

function ProjectCodeMappingsModal({
  Header,
  Body,
  project,
  mappings: initialMappings,
  integrations,
  repos,
}: ModalRenderProps & {
  integrations: OrganizationIntegration[];
  mappings: RepositoryProjectPathConfig[];
  project: Project;
  repos: Repository[];
}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {mutate: deleteMapping} = useDeletePathConfig();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(initialMappings.length === 0);
  const [addFormIntegration, setAddFormIntegration] =
    useState<OrganizationIntegration | null>(
      integrations.length === 1 ? integrations[0]! : null
    );

  // Re-fetch mappings so the list stays current after add/edit/delete
  const {data: liveMappings = initialMappings} = useApiQuery<
    RepositoryProjectPathConfig[]
  >(makeCodeMappingsQueryKey({orgSlug: organization.slug}), {staleTime: 0});
  const mappings = useMemo(
    () => liveMappings.filter(m => m.projectId === project.id),
    [liveMappings, project.id]
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: [`/organizations/${organization.slug}/code-mappings/`],
    });
  }, [queryClient, organization.slug]);

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Code mappings for %s', project.slug)}</h4>
      </Header>
      <Body>
        <Stack gap="lg">
          {/* Existing mappings */}
          {mappings.map(mapping => (
            <MappingCard key={mapping.id}>
              <Flex align="center" justify="between">
                <Stack gap="xs" flex={1}>
                  <Text bold size="sm">
                    {mapping.repoName}
                  </Text>
                  <Text size="sm" variant="muted" monospace>
                    {mapping.stackRoot || '/'} {'\u2192'} {mapping.sourceRoot || '/'}
                    {mapping.defaultBranch && ` (${mapping.defaultBranch})`}
                  </Text>
                </Stack>
                <Flex gap="xs">
                  <Button
                    size="xs"
                    priority="transparent"
                    icon={<IconEdit size="xs" />}
                    aria-label={t('Edit')}
                    disabled={editingId === mapping.id}
                    onClick={() =>
                      setEditingId(editingId === mapping.id ? null : mapping.id)
                    }
                  />
                  <Button
                    size="xs"
                    priority="transparent"
                    icon={<IconDelete size="xs" />}
                    aria-label={t('Delete')}
                    onClick={() => deleteMapping(mapping)}
                  />
                </Flex>
              </Flex>
              {editingId === mapping.id && (
                <FormContainer>
                  <InlineMappingForm
                    projectId={project.id}
                    existingConfig={mapping}
                    integration={integrations.find(i => i.id === mapping.integrationId)!}
                    repos={repos}
                    onSaved={() => {
                      setEditingId(null);
                      invalidate();
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </FormContainer>
              )}
            </MappingCard>
          ))}

          {/* Add form — shown when no mappings exist or toggled */}
          {(showAddForm || mappings.length === 0) && addFormIntegration ? (
            <MappingCard>
              <InlineMappingForm
                projectId={project.id}
                integration={addFormIntegration}
                repos={repos}
                onSaved={() => {
                  setShowAddForm(false);
                  setAddFormIntegration(
                    integrations.length === 1 ? integrations[0]! : null
                  );
                  invalidate();
                }}
                onCancel={() => {
                  // Only hide if there are mappings — otherwise keep form visible
                  if (mappings.length > 0) {
                    setShowAddForm(false);
                  }
                  setAddFormIntegration(
                    integrations.length === 1 ? integrations[0]! : null
                  );
                }}
              />
            </MappingCard>
          ) : (showAddForm || mappings.length === 0) && !addFormIntegration ? (
            // Multiple integrations — pick which one
            <Flex gap="sm" align="center">
              <Text size="sm" variant="muted">
                {t('Select integration:')}
              </Text>
              {integrations.map(i => (
                <Button key={i.id} size="xs" onClick={() => setAddFormIntegration(i)}>
                  {i.name}
                </Button>
              ))}
              <Button
                size="xs"
                priority="transparent"
                onClick={() => setShowAddForm(false)}
              >
                {t('Cancel')}
              </Button>
            </Flex>
          ) : (
            <Button
              size="sm"
              icon={<IconAdd size="xs" />}
              onClick={() => setShowAddForm(true)}
            >
              {t('Add Code Mapping')}
            </Button>
          )}
        </Stack>
      </Body>
    </Fragment>
  );
}

// ─────────────────────────────────────────────────────────────
// Inline mapping form (no project field)
// ─────────────────────────────────────────────────────────────

function InlineMappingForm({
  projectId,
  existingConfig,
  integration,
  repos,
  onSaved,
  onCancel,
}: {
  integration: OrganizationIntegration;
  onCancel: () => void;
  onSaved: () => void;
  projectId: string;
  repos: Repository[];
  existingConfig?: RepositoryProjectPathConfig;
}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const isStreamBased = integration.provider.key === 'perforce';
  const integrationRepos = repos.filter(r => r.integrationId === integration.id);
  const repoOptions = integrationRepos.map(({name, id}) => ({
    value: id,
    label: name,
  }));

  const schema = z.object({
    projectId: z.string().min(1),
    repositoryId: z.string().min(1, t('Repository is required')),
    defaultBranch: isStreamBased
      ? z.string()
      : z.string().min(1, t('Branch is required')),
    stackRoot: z.string(),
    sourceRoot: z.string(),
    integrationId: z.string(),
  });

  const endpoint = existingConfig
    ? getApiUrl(`/organizations/$organizationIdOrSlug/code-mappings/$configId/`, {
        path: {
          organizationIdOrSlug: organization.slug,
          configId: existingConfig.id,
        },
      })
    : getApiUrl(`/organizations/$organizationIdOrSlug/code-mappings/`, {
        path: {organizationIdOrSlug: organization.slug},
      });

  const mutation = useMutation({
    mutationFn: (data: Partial<RepositoryProjectPathConfig>) =>
      fetchMutation({
        method: existingConfig ? 'PUT' : 'POST',
        url: endpoint,
        data,
      }),
    onError: e => {
      Sentry.captureException(e);
      addErrorMessage(t('Failed to save code mapping'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Code mapping saved'));
      onSaved();
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      projectId,
      repositoryId: existingConfig?.repoId ?? '',
      defaultBranch: existingConfig?.defaultBranch ?? (isStreamBased ? '' : 'main'),
      stackRoot: existingConfig?.stackRoot ?? '',
      sourceRoot: existingConfig?.sourceRoot ?? '',
      integrationId: integration.id,
    },
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      return mutation.mutateAsync(value).catch(() => {});
    },
  });

  return (
    <form.AppForm form={form}>
      <Stack gap="md">
        <form.AppField
          name="repositoryId"
          listeners={{
            onChange: async ({value}) => {
              const repoLabel = repoOptions.find(opt => opt.value === value)?.label;
              if (!repoLabel) {
                return;
              }
              if (form.getFieldMeta('defaultBranch')?.isBlurred) {
                return;
              }
              try {
                const data = await queryClient.fetchQuery(
                  integrationReposOptions(organization.slug, integration.id, repoLabel)
                );
                const defaultBranch = data.json.repos.find(
                  r => r.identifier === repoLabel
                )?.defaultBranch;
                if (defaultBranch) {
                  form.setFieldValue('defaultBranch', defaultBranch);
                }
              } catch {
                // keep current value
              }
            },
          }}
        >
          {field => (
            <field.Layout.Stack label={t('Repo')} required>
              <field.Select
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t('Choose repo')}
                options={repoOptions}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>

        <form.AppField name="defaultBranch">
          {field => (
            <field.Layout.Stack
              label={isStreamBased ? t('Stream') : t('Branch')}
              variant="compact"
              required={!isStreamBased}
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={
                  isStreamBased ? t('Type your stream (optional)') : t('Type your branch')
                }
              />
            </field.Layout.Stack>
          )}
        </form.AppField>

        <form.AppField name="stackRoot">
          {field => (
            <field.Layout.Stack label={t('Stack Trace Root')} variant="compact">
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t('e.g. src/')}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>

        <form.AppField name="sourceRoot">
          {field => (
            <field.Layout.Stack label={t('Source Code Root')} variant="compact">
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t('e.g. src/')}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>

        <Flex gap="sm" justify="end">
          <Button size="sm" onClick={onCancel}>
            {t('Cancel')}
          </Button>
          <form.SubmitButton size="sm" priority="primary">
            {t('Save')}
          </form.SubmitButton>
        </Flex>
      </Stack>
    </form.AppForm>
  );
}

// ─────────────────────────────────────────────────────────────
// Styled components
// ─────────────────────────────────────────────────────────────

const ProjectRowContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${p => p.theme.space.md} 0;
  border-bottom: 1px solid ${p => p.theme.tokens.border.neutral.muted};
`;

const MappingCard = styled('div')`
  padding: ${p => p.theme.space.lg};
  border: 1px solid ${p => p.theme.tokens.border.neutral.muted};
  border-radius: ${p => p.theme.radius.md};
`;

const FormContainer = styled('div')`
  margin-top: ${p => p.theme.space.lg};
  padding-top: ${p => p.theme.space.lg};
  border-top: 1px solid ${p => p.theme.tokens.border.neutral.muted};
`;
