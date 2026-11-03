import {Fragment, useRef} from 'react';
import {uuid4} from '@sentry/core';
import {IconClose} from '@sentry/icons/close';
import {IconFire} from '@sentry/icons/fire';
import {skipToken, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {
  defaultFormOptions,
  DisplayField,
  setFieldErrors,
  useScrapsForm,
} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tn} from 'sentry/locale';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';
import type {SeerWorkflowConfigResponse} from 'sentry/views/seerWorkflows/types';
import {
  getAutomationDetailPath,
  getAutomationsPath,
} from 'sentry/views/seerWorkflows/utils';

const agentProjectsSchema = z.discriminatedUnion('mode', [
  z.object({mode: z.literal('monitors')}),
  z.object({mode: z.literal('selected'), projectIds: z.array(z.string())}),
  z.object({mode: z.literal('all')}),
]);

const schema = z.object({
  name: z.string().trim().min(1, t('Give your automation a name.')).max(64),
  enabled: z.boolean(),
  monitorIds: z.array(z.string()),
  agentProjects: agentProjectsSchema,
  scopes: z.array(z.string()).min(1, t('Select at least one permission scope.')),
});

const DEFAULT_AGENT_SCOPES = [
  'event:read',
  'member:read',
  'org:read',
  'project:read',
  'team:read',
];

type ServiceAccount = {
  allProjects: boolean;
  id: string;
  isActive: boolean;
  name: string;
  projectIds: string[];
  scopes: string[];
};

type Props = {mode: 'create'} | {config: SeerWorkflowConfigResponse; mode: 'edit'};

export function MetricAutomationForm(props: Props) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {projects} = useProjects();
  const createdAccountId = useRef<string | null>(null);
  const serviceAccountId = props.mode === 'edit' ? props.config.serviceAccountId : null;
  const accountQuery = useQuery(
    serviceAccountQueryOptions(organization.slug, serviceAccountId)
  );
  const account = accountQuery.data;
  const grantableScopes = new Set<string>(organization.access);
  const availableScopes = organization.access.filter(
    scope =>
      scope.includes(':') &&
      !scope.startsWith('service_account:') &&
      scope !== 'org:superuser' &&
      scope !== 'org:billing'
  );
  const monitorsQuery = useQuery(
    detectorListApiOptions(organization, {
      query: 'type:metric_issue',
      projects: [-1],
      limit: 100,
    })
  );
  const monitors =
    monitorsQuery.data?.filter(monitor => monitor.type === 'metric_issue') ?? [];
  const accountUnavailable =
    !!serviceAccountId && (accountQuery.isPending || accountQuery.isError);
  const getProjectSlug = (projectId: string) =>
    projects.find(project => project.id === projectId)?.slug ?? projectId;
  const configsUrl = getApiUrl(
    '/organizations/$organizationIdOrSlug/seer/workflows/configs/',
    {path: {organizationIdOrSlug: organization.slug}}
  );
  const mutation = useMutation({
    mutationFn: async (value: z.infer<typeof schema>) => {
      const accountId = serviceAccountId ?? createdAccountId.current;
      const savedAccount = await fetchMutation<ServiceAccount>({
        url: accountId
          ? getApiUrl(
              '/organizations/$organizationIdOrSlug/service-accounts/$serviceAccountId/',
              {
                path: {
                  organizationIdOrSlug: organization.slug,
                  serviceAccountId: accountId,
                },
              }
            )
          : getApiUrl('/organizations/$organizationIdOrSlug/service-accounts/', {
              path: {organizationIdOrSlug: organization.slug},
            }),
        method: accountId ? 'PUT' : 'POST',
        data: {
          ...(!accountId && {
            name: `Seer ${value.name.slice(0, 48)} ${uuid4().slice(0, 8)}`,
          }),
          scopes: value.scopes,
          projectIds: resolveAgentProjects(
            value.agentProjects,
            value.monitorIds,
            monitors
          ).map(Number),
          allProjects: value.agentProjects.mode === 'all',
        },
      });
      createdAccountId.current = savedAccount.id;
      const config = await fetchMutation<SeerWorkflowConfigResponse>({
        url:
          props.mode === 'create'
            ? configsUrl
            : getApiUrl(
                '/organizations/$organizationIdOrSlug/seer/workflows/configs/$configId/',
                {
                  path: {
                    organizationIdOrSlug: organization.slug,
                    configId: props.config.id,
                  },
                }
              ),
        method: props.mode === 'create' ? 'POST' : 'PUT',
        data:
          props.mode === 'create'
            ? {
                strategy: 'breached_metric_investigation',
                name: value.name,
                enabled: value.enabled,
                monitorIds: value.monitorIds.map(Number),
                serviceAccountId: savedAccount.id,
              }
            : {
                enabled: value.enabled,
                monitorIds: value.monitorIds.map(Number),
                ...(!serviceAccountId && {serviceAccountId: savedAccount.id}),
              },
      });
      return {config, account: savedAccount};
    },
    retry: (failureCount, error) =>
      error instanceof RequestError && error.status === 409 && failureCount < 4,
    retryDelay: attempt => Math.min(500 * 2 ** attempt, 4000),
    onSuccess: async ({config, account: savedAccount}) => {
      queryClient.setQueryData(
        serviceAccountQueryOptions(organization.slug, savedAccount.id).queryKey,
        previous => ({json: savedAccount, headers: previous?.headers ?? {}})
      );
      await queryClient.invalidateQueries({queryKey: [configsUrl]});
      addSuccessMessage(
        props.mode === 'create' ? t('Automation created.') : t('Automation saved.')
      );
      if (props.mode === 'create') {
        navigate(getAutomationDetailPath(organization.slug, config.id));
      }
    },
  });
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      enabled: props.mode === 'edit' ? props.config.enabled : false,
      name:
        props.mode === 'create'
          ? t('Breached Metric Investigation')
          : (props.config.name ?? t('Breached metrics')),
      monitorIds: props.mode === 'create' ? [] : props.config.monitorIds.map(String),
      agentProjects: getAgentProjectSelection(account),
      scopes:
        account?.scopes ??
        DEFAULT_AGENT_SCOPES.filter(scope => grantableScopes.has(scope)),
    },
    validators: {onDynamic: schema},
    onSubmit: async ({value, formApi}) => {
      try {
        const {config, account: savedAccount} = await mutation.mutateAsync(
          schema.parse(value)
        );
        if (props.mode === 'edit') {
          formApi.reset({
            name: value.name,
            enabled: config.enabled,
            monitorIds: config.monitorIds.map(String),
            agentProjects: getAgentProjectSelection(savedAccount),
            scopes: savedAccount.scopes,
          });
        }
      } catch (error) {
        if (error instanceof RequestError) {
          setFieldErrors(formApi, requestErrorToFieldErrors(error, formApi.state.values));
        }
      }
    },
  });

  return (
    <Container maxWidth="960px" width="100%" containerType="inline-size">
      <form.AppForm form={form}>
        <Stack gap="lg">
          {mutation.isError && (
            <Alert variant="danger">
              {getRequestErrorUserMessage(
                mutation.error,
                t('Unable to save automation.')
              )}
            </Alert>
          )}
          <form.FieldGroup title={t('Details')}>
            {props.mode === 'create' ? (
              <form.AppField name="name">
                {field => (
                  <field.Layout.Stack label={t('Name')} required>
                    <field.Input
                      value={field.state.value}
                      onChange={field.handleChange}
                      placeholder={t('e.g. Investigate checkout errors')}
                      maxLength={64}
                    />
                  </field.Layout.Stack>
                )}
              </form.AppField>
            ) : (
              <DisplayField.Row label={t('Name')}>
                <Text>{props.config.name ?? t('Breached metrics')}</Text>
              </DisplayField.Row>
            )}
            <DisplayField.Stack label={t('Description')}>
              <Text variant="muted">
                {t(
                  'Investigate metric breaches using related errors, traces, and recent changes to find likely causes.'
                )}
              </Text>
            </DisplayField.Stack>
          </form.FieldGroup>

          <form.FieldGroup title={t('Trigger')}>
            <DisplayField.Row
              label={t('Metric breach')}
              hintText={t('Runs when any connected monitor crosses its alert threshold.')}
            >
              <Flex>
                <Tag icon={<IconFire />} variant="muted">
                  {t('When a monitor breaches')}
                </Tag>
              </Flex>
            </DisplayField.Row>
          </form.FieldGroup>

          <form.FieldGroup title={t('Scope')}>
            <form.Subscribe selector={state => state.values.monitorIds}>
              {monitorIds => {
                const selected = monitors.filter(monitor =>
                  monitorIds.includes(monitor.id)
                );
                const projectIds = new Set(selected.map(monitor => monitor.projectId));

                return (
                  <Fragment>
                    <Stack gap="lg">
                      {monitorsQuery.isError ? (
                        <LoadingError onRetry={monitorsQuery.refetch} />
                      ) : (
                        <form.AppField name="monitorIds">
                          {field => (
                            <field.Layout.Stack
                              label={t('Connected monitors')}
                              hintText={t(
                                'Search by monitor or project name. You can connect more than one.'
                              )}
                            >
                              <field.Select
                                multiple
                                clearable
                                searchable
                                value={field.state.value}
                                onChange={field.handleChange}
                                isLoading={monitorsQuery.isPending}
                                placeholder={t('Connect metric monitors…')}
                                options={monitors.map(monitor => ({
                                  value: monitor.id,
                                  label: `${monitor.name} · ${getProjectSlug(monitor.projectId)}`,
                                }))}
                              />
                            </field.Layout.Stack>
                          )}
                        </form.AppField>
                      )}
                      {monitorIds.length === 0 ? (
                        <Stack
                          padding="xl"
                          gap="sm"
                          align="center"
                          background="secondary"
                          radius="md"
                        >
                          <Text bold>{t('No monitors connected')}</Text>
                          <Text variant="muted" align="center">
                            {t(
                              'Connect a metric monitor above, or save now and choose monitors later.'
                            )}
                          </Text>
                        </Stack>
                      ) : (
                        <Stack gap="md">
                          <Text size="sm" variant="muted">
                            {tn(
                              '%s monitor connected',
                              '%s monitors connected',
                              monitorIds.length
                            )}
                            {' · '}
                            {tn('%s project', '%s projects', projectIds.size)}
                          </Text>
                          <Stack border="primary" radius="md">
                            {selected.map((monitor, index) => (
                              <Flex
                                key={monitor.id}
                                align="center"
                                justify="between"
                                gap="md"
                                padding="lg"
                                borderTop={index ? 'primary' : undefined}
                              >
                                <Stack gap="xs" minWidth={0}>
                                  <ExternalLink
                                    href={makeMonitorDetailsPathname(
                                      organization.slug,
                                      monitor.id
                                    )}
                                  >
                                    {monitor.name}
                                  </ExternalLink>
                                  <Text size="sm" variant="muted">
                                    {getProjectSlug(monitor.projectId)}
                                    {!monitor.enabled && ` · ${t('Monitor paused')}`}
                                  </Text>
                                </Stack>
                                <Button
                                  size="xs"
                                  variant="transparent"
                                  icon={<IconClose />}
                                  aria-label={t('Disconnect %s', monitor.name)}
                                  onClick={() =>
                                    form.setFieldValue(
                                      'monitorIds',
                                      monitorIds.filter(id => id !== monitor.id)
                                    )
                                  }
                                />
                              </Flex>
                            ))}
                          </Stack>
                        </Stack>
                      )}
                    </Stack>
                    <DisplayField.Row label={t('Projects and environments')}>
                      {monitorIds.length === 0 ? (
                        <Text variant="muted">
                          {t('Connect monitors to see their projects and environments.')}
                        </Text>
                      ) : monitorsQuery.isPending ? (
                        <Text variant="muted">{t('Loading monitor scope…')}</Text>
                      ) : monitorsQuery.isError ? (
                        <Text variant="muted">{t('Monitor scope is unavailable.')}</Text>
                      ) : (
                        <Stack gap="md">
                          {Array.from(projectIds, projectId => {
                            const environments = selected
                              .filter(monitor => monitor.projectId === projectId)
                              .map(
                                monitor =>
                                  monitor.dataSources[0].queryObj.snubaQuery.environment
                              );

                            return (
                              <Stack key={projectId} gap="xs">
                                <Text>{getProjectSlug(projectId)}</Text>
                                <Text size="sm" variant="muted">
                                  {environments.some(environment => !environment)
                                    ? t('All environments')
                                    : [...new Set(environments)].join(', ')}
                                </Text>
                              </Stack>
                            );
                          })}
                        </Stack>
                      )}
                    </DisplayField.Row>
                  </Fragment>
                );
              }}
            </form.Subscribe>
          </form.FieldGroup>

          <form.FieldGroup title={t('Actions')}>
            <form.AppField name="enabled">
              {field => (
                <field.Layout.Row
                  label={t('Start investigations')}
                  hintText={t(
                    'Automatically investigate connected monitor breaches. Turn off to pause this automation.'
                  )}
                >
                  <field.Switch
                    checked={field.state.value}
                    onChange={field.handleChange}
                  />
                </field.Layout.Row>
              )}
            </form.AppField>
          </form.FieldGroup>

          <form.FieldGroup title={t('Agent Capabilities')}>
            {accountUnavailable && accountQuery.isPending ? (
              <LoadingIndicator />
            ) : accountUnavailable ? (
              <LoadingError onRetry={accountQuery.refetch} />
            ) : (
              <Stack gap="lg">
                <Text variant="muted">
                  {t(
                    'Choose what the agent can access during an investigation. These permissions are saved on its service account.'
                  )}
                </Text>
                <form.Subscribe selector={state => state.values.monitorIds}>
                  {monitorIds => (
                    <form.AppField name="agentProjects">
                      {field => (
                        <field.Layout.Stack
                          label={t('Agent projects')}
                          hintText={t(
                            'Start with monitor projects, then add other projects the agent may need to investigate.'
                          )}
                        >
                          <Stack gap="md">
                            <field.Select
                              multiple
                              clearable
                              searchable
                              disabled={field.state.value.mode === 'all'}
                              value={resolveAgentProjects(
                                field.state.value,
                                monitorIds,
                                monitors
                              )}
                              onChange={projectIds =>
                                field.handleChange({mode: 'selected', projectIds})
                              }
                              options={projects.map(project => ({
                                value: project.id,
                                label: project.slug,
                              }))}
                              placeholder={
                                field.state.value.mode === 'all'
                                  ? t('All projects')
                                  : t('Select projects…')
                              }
                            />
                            <Flex align="center" justify="between" gap="md" wrap="wrap">
                              <Text variant="muted" size="sm">
                                {field.state.value.mode === 'monitors'
                                  ? t('Using connected monitor projects.')
                                  : t(
                                      'Project access is independent of connected monitors.'
                                    )}
                              </Text>
                              {field.state.value.mode !== 'monitors' && (
                                <Button
                                  size="xs"
                                  onClick={() => field.handleChange({mode: 'monitors'})}
                                >
                                  {t('Use monitor projects')}
                                </Button>
                              )}
                            </Flex>
                          </Stack>
                        </field.Layout.Stack>
                      )}
                    </form.AppField>
                  )}
                </form.Subscribe>
                <form.AppField name="scopes">
                  {field => (
                    <field.Layout.Stack
                      label={t('Permission scopes')}
                      hintText={t(
                        'Starts with read access for investigations. Add write permissions only for actions you want the agent to perform.'
                      )}
                      required
                    >
                      <field.Select
                        multiple
                        clearable
                        searchable
                        value={field.state.value}
                        onChange={field.handleChange}
                        options={[...new Set([...availableScopes, ...field.state.value])]
                          .sort()
                          .map(scope => ({value: scope, label: scope}))}
                      />
                    </field.Layout.Stack>
                  )}
                </form.AppField>
                <DisplayField.Row label={t('Service account')}>
                  <Text>{account ? account.name : t('Created when you save')}</Text>
                </DisplayField.Row>
                {account && !account.isActive && (
                  <Alert variant="warning">
                    {t(
                      'This service account is paused. Its permissions can be edited, but the agent cannot use it while it is paused.'
                    )}
                  </Alert>
                )}
              </Stack>
            )}
          </form.FieldGroup>

          <Flex align="center" justify="between" gap="lg" wrap="wrap">
            <Text variant="muted" size="sm">
              {t('Changes apply when you save.')}
            </Text>
            <Flex gap="md">
              {props.mode === 'create' ? (
                <LinkButton to={getAutomationsPath(organization.slug)}>
                  {t('Cancel')}
                </LinkButton>
              ) : (
                <form.ResetButton>{t('Discard changes')}</form.ResetButton>
              )}
              <form.SubmitButton
                variant="primary"
                disabled={
                  monitorsQuery.isPending || monitorsQuery.isError || accountUnavailable
                }
              >
                {props.mode === 'create' ? t('Create automation') : t('Save changes')}
              </form.SubmitButton>
            </Flex>
          </Flex>
        </Stack>
      </form.AppForm>
    </Container>
  );
}

function serviceAccountQueryOptions(
  organizationSlug: string,
  serviceAccountId: string | null
) {
  return apiOptions.as<ServiceAccount>()(
    '/organizations/$organizationIdOrSlug/service-accounts/$serviceAccountId/',
    {
      path: serviceAccountId
        ? {organizationIdOrSlug: organizationSlug, serviceAccountId}
        : skipToken,
      staleTime: 0,
    }
  );
}

function getAgentProjectSelection(
  account: ServiceAccount | undefined
): z.infer<typeof agentProjectsSchema> {
  if (!account) {
    return {mode: 'monitors'};
  }
  return account.allProjects
    ? {mode: 'all'}
    : {mode: 'selected', projectIds: account.projectIds};
}

function resolveAgentProjects(
  selection: z.infer<typeof agentProjectsSchema>,
  monitorIds: string[],
  monitors: MetricDetector[]
): string[] {
  switch (selection.mode) {
    case 'monitors':
      return [
        ...new Set(
          monitors
            .filter(monitor => monitorIds.includes(monitor.id))
            .map(monitor => monitor.projectId)
        ),
      ];
    case 'selected':
      return selection.projectIds;
    case 'all':
      return [];
  }
}
