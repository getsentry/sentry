import {Fragment} from 'react';
import {IconClose} from '@sentry/icons/close';
import {IconFire} from '@sentry/icons/fire';
import {queryOptions, useQuery, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {
  defaultFormValidators,
  ScrapsForm,
  DisplayField,
  useScrapsForm,
  useSelector,
} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {LoadingError} from 'sentry/components/loadingError';
import {t, tn} from 'sentry/locale';
import type {Detector, MetricDetector} from 'sentry/types/workflowEngine/detectors';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';
import type {
  SeerServiceAccountResponse,
  SeerWorkflowConfigResponse,
} from 'sentry/views/seerWorkflows/types';
import {
  getAutomationDetailPath,
  getAutomationsPath,
} from 'sentry/views/seerWorkflows/utils';

import {useCreateConfig, useUpdateConfig} from './hooks/configs';

const serviceAccountProjectsSchema = z.discriminatedUnion('mode', [
  z.object({mode: z.literal('monitors')}),
  z.object({mode: z.literal('selected'), projectIds: z.array(z.string())}),
  z.object({mode: z.literal('all')}),
]);

const schema = z.object({
  name: z.string().trim().min(1, t('Give your automation a name.')).max(64),
  enabled: z.boolean(),
  monitorIds: z.array(z.string()),
  serviceAccountProjects: serviceAccountProjectsSchema,
  scopes: z.array(z.string()).min(1, t('Select at least one permission scope.')),
});

const DEFAULT_SERVICE_ACCOUNT_SCOPES = [
  'event:read',
  'member:read',
  'org:read',
  'project:read',
  'team:read',
];

type Props = {mode: 'create'} | {config: SeerWorkflowConfigResponse; mode: 'edit'};

export function MetricAutomationForm(props: Props) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {projects} = useProjects();
  const serviceAccount = props.mode === 'edit' ? props.config.serviceAccount : null;
  const grantableScopes = new Set<string>(organization.access);
  const availableScopes = organization.access.filter(
    scope =>
      scope.includes(':') &&
      !scope.startsWith('service_account:') &&
      scope !== 'org:superuser' &&
      scope !== 'org:billing'
  );
  const getProjectSlug = (projectId: string) =>
    projects.find(project => project.id === projectId)?.slug ?? projectId;
  const createConfig = useCreateConfig();
  // Only called in edit mode, where the config ID is known
  const updateConfig = useUpdateConfig({
    configId: props.mode === 'edit' ? props.config.id : '',
  });
  const mutationError = props.mode === 'create' ? createConfig.error : updateConfig.error;
  const saveConfig = async (value: z.infer<typeof schema>) => {
    const fields = {
      enabled: value.enabled,
      monitorIds: value.monitorIds.map(Number),
      serviceAccount: {
        scopes: value.scopes,
        projectIds: resolveServiceAccountProjects(
          value.serviceAccountProjects,
          value.monitorIds,
          monitors
        ).map(Number),
        allProjects: value.serviceAccountProjects.mode === 'all',
      },
    };
    if (props.mode === 'create') {
      const config = await createConfig.mutateAsync({
        ...fields,
        strategy: 'breached_metric_investigation',
        name: value.name,
      });
      toast.success(t('Automation created.'));
      navigate(getAutomationDetailPath(organization.slug, config.id));
      return config;
    }
    const config = await updateConfig.mutateAsync(fields);
    toast.success(t('Automation saved.'));
    return config;
  };
  const form = useScrapsForm({
    defaultValues: {
      enabled: props.mode === 'edit' ? props.config.enabled : false,
      name:
        props.mode === 'create'
          ? t('Breached Metric Investigation')
          : (props.config.name ?? t('Breached metrics')),
      monitorIds: props.mode === 'create' ? [] : props.config.monitorIds.map(String),
      serviceAccountProjects: getServiceAccountProjectSelection(serviceAccount),
      scopes:
        serviceAccount?.scopes ??
        DEFAULT_SERVICE_ACCOUNT_SCOPES.filter(scope => grantableScopes.has(scope)),
    },
    validators: defaultFormValidators(schema),
    onSubmit: async ({value, formApi, createValidationError}) => {
      try {
        const config = await saveConfig(schema.parse(value));
        if (props.mode === 'edit') {
          formApi.reset({
            name: value.name,
            enabled: config.enabled,
            monitorIds: config.monitorIds.map(String),
            serviceAccountProjects: getServiceAccountProjectSelection(
              config.serviceAccount
            ),
            scopes: config.serviceAccount?.scopes ?? value.scopes,
          });
        }
      } catch (error) {
        if (error instanceof RequestError) {
          const fields = requestErrorToFieldErrors(error, value);
          if (fields) {
            return createValidationError({fields});
          }
        }
      }
      return;
    },
  });
  // Fetch connected monitors by ID so they resolve even when they aren't in the
  // picker's current search results
  const queryClient = useQueryClient();
  const monitorIds = useSelector(form.atom, state => state.values.monitorIds);
  const monitorsQueryOptions = detectorListApiOptions(organization, {
    ids: monitorIds,
    projects: [-1],
    limit: 100,
  });
  const monitorsQuery = useQuery({
    ...monitorsQueryOptions,
    enabled: monitorIds.length > 0,
    // Show monitors already fetched by the picker's search or an earlier lookup while
    // the by-ID fetch runs, so a newly connected monitor appears right away
    placeholderData: previous => {
      const known = new Map<string, Detector>();
      for (const [, data] of queryClient.getQueriesData<ApiResponse<Detector[]>>({
        queryKey: [monitorsQueryOptions.queryKey[0]],
      })) {
        data?.json.forEach(monitor => known.set(monitor.id, monitor));
      }
      previous?.json.forEach(monitor => known.set(monitor.id, monitor));
      const json = monitorIds.flatMap(id => known.get(id) ?? []);
      return json.length > 0 ? {json, headers: {}} : undefined;
    },
  });
  // The query is disabled with no monitors connected, so its state only matters otherwise
  const hasMonitorsError = monitorIds.length > 0 && monitorsQuery.isError;
  const isResolvingMonitors =
    monitorIds.length > 0 && (monitorsQuery.isLoading || monitorsQuery.isPlaceholderData);
  // For typing
  const monitors =
    monitorIds.length > 0
      ? (monitorsQuery.data?.filter(monitor => monitor.type === 'metric_issue') ?? [])
      : [];

  return (
    <Container maxWidth="960px" width="100%" containerType="inline-size">
      <ScrapsForm form={form}>
        <Stack gap="lg">
          {mutationError && (
            <Alert variant="danger">
              {getRequestErrorUserMessage(mutationError, t('Unable to save automation.'))}
            </Alert>
          )}
          <form.FieldGroup title={t('Description')}>
            {props.mode === 'create' && (
              <form.Field name="name">
                {field => (
                  <field.Layout.Stack label={t('Name')} required>
                    <field.Input
                      value={field.value}
                      onChange={field.handleChange}
                      placeholder={t('e.g. Investigate checkout errors')}
                      maxLength={64}
                    />
                  </field.Layout.Stack>
                )}
              </form.Field>
            )}
            <Container padding="lg xl">
              <Text variant="muted">
                {t(
                  'Investigate metric breaches using related errors, traces, and recent changes to find likely causes.'
                )}
              </Text>
            </Container>
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
            <Fragment>
              <Stack gap="lg">
                <form.Field name="monitorIds">
                  {field => (
                    <field.Layout.Stack
                      label={t('Connected monitors')}
                      hintText={t(
                        'Search by monitor name. You can connect more than one.'
                      )}
                    >
                      {/* TODO: The picker flashes while typing monitor names.
                         Suspected cause, in SelectAsyncField (components/core/form/field/selectAsyncField.tsx):
                         - Each debounced input is a new query key, and it reads `data: options = []`, so the
                           options are empty until each new search returns.
                         - It also shows loading whenever the input differs from the debounced value, so the
                           loading state appears on every keystroke even before a request starts.
                         Likely fix: add `placeholderData: keepPreviousData` to the queryOptions below so the
                         previous results stay visible, and/or only show loading in SelectAsyncField when there
                         are no options to display. */}
                      <field.SelectAsync
                        multiple
                        clearable
                        value={field.value}
                        onChange={field.handleChange}
                        placeholder={t('Connect metric monitors…')}
                        queryOptions={debouncedInput => {
                          // Filter query by form input
                          const baseOptions = detectorListApiOptions(organization, {
                            query: debouncedInput
                              ? `type:metric_issue name:"*${escapeSearchValue(debouncedInput)}*"`
                              : 'type:metric_issue',
                            projects: [-1],
                            limit: 100,
                            sortBy: '-latestGroup',
                          });
                          return queryOptions({
                            ...baseOptions,
                            select: ({json}) => {
                              const results = json.filter(
                                monitor => monitor.type === 'metric_issue'
                              );
                              // Keep already-selected monitors in the options so their labels still render
                              const selected = monitors.filter(
                                monitor =>
                                  field.value.includes(monitor.id) &&
                                  !results.some(result => result.id === monitor.id)
                              );
                              return [...selected, ...results].map(monitor => ({
                                value: monitor.id,
                                label: `${monitor.name} · ${getProjectSlug(monitor.projectId)}`,
                              }));
                            },
                          });
                        }}
                      />
                    </field.Layout.Stack>
                  )}
                </form.Field>
                {hasMonitorsError && <LoadingError onRetry={monitorsQuery.refetch} />}
                <ConnectedMonitorList
                  monitorIds={monitorIds}
                  monitors={monitors}
                  getProjectSlug={getProjectSlug}
                  onDisconnect={monitorId =>
                    form.setFieldValue(
                      'monitorIds',
                      monitorIds.filter(id => id !== monitorId)
                    )
                  }
                />
              </Stack>
              <DisplayField.Row label={t('Projects and environments')}>
                <MonitorProjectsSummary
                  monitorIds={monitorIds}
                  monitors={monitors}
                  isPending={monitorsQuery.isLoading}
                  isError={monitorsQuery.isError}
                  getProjectSlug={getProjectSlug}
                />
              </DisplayField.Row>
            </Fragment>
          </form.FieldGroup>

          <form.FieldGroup title={t('Actions')}>
            <form.Field name="enabled">
              {field => (
                <field.Layout.Row
                  label={t('Start investigations')}
                  hintText={t(
                    'Automatically investigate connected monitor breaches. Turn off to pause this automation.'
                  )}
                >
                  <field.Switch checked={field.value} onChange={field.handleChange} />
                </field.Layout.Row>
              )}
            </form.Field>
          </form.FieldGroup>

          <form.FieldGroup title={t('Service account capabilities')}>
            <Stack gap="lg">
              <Text variant="muted">
                {t(
                  "Choose what this automation's service account can access during an investigation."
                )}
              </Text>
              <form.Field name="serviceAccountProjects">
                {field => (
                  <field.Layout.Stack
                    label={t('Service account projects')}
                    hintText={t(
                      'Start with monitor projects, then add other projects the service account may need to investigate.'
                    )}
                  >
                    <Stack gap="md">
                      <field.Select
                        multiple
                        clearable
                        searchable
                        disabled={field.value.mode === 'all'}
                        value={resolveServiceAccountProjects(
                          field.value,
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
                          field.value.mode === 'all'
                            ? t('All projects')
                            : t('Select projects…')
                        }
                      />
                      <Flex align="center" justify="between" gap="md" wrap="wrap">
                        <Text variant="muted" size="sm">
                          {field.value.mode === 'monitors'
                            ? t('Using connected monitor projects.')
                            : t('Project access is independent of connected monitors.')}
                        </Text>
                        {field.value.mode !== 'monitors' && (
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
              </form.Field>
              <form.Field name="scopes">
                {field => (
                  <field.Layout.Stack
                    label={t('Permission scopes')}
                    hintText={t(
                      'Starts with read access for investigations. Add write permissions only for actions you want the service account to perform.'
                    )}
                    required
                  >
                    <field.Select
                      multiple
                      clearable
                      searchable
                      value={field.value}
                      onChange={field.handleChange}
                      options={[...new Set([...availableScopes, ...field.value])]
                        .sort()
                        .map(scope => ({value: scope, label: scope}))}
                    />
                  </field.Layout.Stack>
                )}
              </form.Field>
            </Stack>
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
                disabled={isResolvingMonitors || hasMonitorsError}
              >
                {props.mode === 'create' ? t('Create automation') : t('Save changes')}
              </form.SubmitButton>
            </Flex>
          </Flex>
        </Stack>
      </ScrapsForm>
    </Container>
  );
}

type MonitorScopeProps = {
  getProjectSlug: (projectId: string) => string;
  monitorIds: string[];
  monitors: MetricDetector[];
};

function ConnectedMonitorList({
  monitorIds,
  monitors,
  getProjectSlug,
  onDisconnect,
}: MonitorScopeProps & {onDisconnect: (monitorId: string) => void}) {
  const organization = useOrganization();

  if (monitorIds.length === 0) {
    return (
      <Stack padding="xl" gap="sm" align="center" background="secondary" radius="md">
        <Text bold>{t('No monitors connected')}</Text>
        <Text variant="muted" align="center">
          {t('Connect a metric monitor above, or save now and choose monitors later.')}
        </Text>
      </Stack>
    );
  }

  const selected = monitors.filter(monitor => monitorIds.includes(monitor.id));
  const projectCount = new Set(selected.map(monitor => monitor.projectId)).size;

  return (
    <Stack gap="md">
      <Text size="sm" variant="muted">
        {tn('%s monitor connected', '%s monitors connected', monitorIds.length)}
        {' · '}
        {tn('%s project', '%s projects', projectCount)}
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
                href={makeMonitorDetailsPathname(organization.slug, monitor.id)}
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
              onClick={() => onDisconnect(monitor.id)}
            />
          </Flex>
        ))}
      </Stack>
    </Stack>
  );
}

function MonitorProjectsSummary({
  monitorIds,
  monitors,
  getProjectSlug,
  isPending,
  isError,
}: MonitorScopeProps & {isError: boolean; isPending: boolean}) {
  if (monitorIds.length === 0) {
    return (
      <Text variant="muted">
        {t('Connect monitors to see their projects and environments.')}
      </Text>
    );
  }
  if (isPending) {
    return <Text variant="muted">{t('Loading monitor scope…')}</Text>;
  }
  if (isError) {
    return <Text variant="muted">{t('Monitor scope is unavailable.')}</Text>;
  }

  const selected = monitors.filter(monitor => monitorIds.includes(monitor.id));
  const projectIds = new Set(selected.map(monitor => monitor.projectId));

  return (
    <Stack gap="md">
      {Array.from(projectIds, projectId => {
        const environments = selected
          .filter(monitor => monitor.projectId === projectId)
          .map(monitor => monitor.dataSources[0].queryObj.snubaQuery.environment);

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
  );
}

function getServiceAccountProjectSelection(
  serviceAccount: SeerServiceAccountResponse | null
): z.infer<typeof serviceAccountProjectsSchema> {
  if (!serviceAccount) {
    return {mode: 'monitors'};
  }
  return serviceAccount.allProjects
    ? {mode: 'all'}
    : {mode: 'selected', projectIds: serviceAccount.projectIds.map(String)};
}

function resolveServiceAccountProjects(
  selection: z.infer<typeof serviceAccountProjectsSchema>,
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

/**
 * Escapes text for use inside a quoted wildcard search value. The search parser
 * only unescapes `\"` and `\*`, so backslashes are dropped rather than escaped.
 */
function escapeSearchValue(value: string): string {
  return value.replace(/[\\"*]/g, char => (char === '\\' ? '' : `\\${char}`));
}
