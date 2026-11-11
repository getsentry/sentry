import {useEffect, useImperativeHandle, type RefObject} from 'react';
import {IconAdd} from '@sentry/icons/add';
import {IconClose} from '@sentry/icons/close';
import {IconFire} from '@sentry/icons/fire';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {useDrawer} from '@sentry/scraps/drawer';
import {
  defaultFormOptions,
  DisplayField,
  setFieldErrors,
  useScrapsForm,
  useStore,
} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

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
import type {
  SeerServiceAccountResponse,
  SeerWorkflowConfigResponse,
} from 'sentry/views/seerWorkflows/types';
import {
  getAutomationDetailPath,
  getAutomationsPath,
} from 'sentry/views/seerWorkflows/utils';

import {useCreateConfig, useUpdateConfig} from './hooks/configs';
import {ConnectMonitorsDrawer} from './connectMonitorsDrawer';
import {MonitorTable} from './monitorTable';

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

export type MetricAutomationFormHandle = {reset: () => void};

type Props =
  | {mode: 'create'}
  | {
      config: SeerWorkflowConfigResponse;
      /**
       * Lets a submit button outside the form target it
       */
      formId: string;
      /**
       * Exposes the form's reset so callers outside the form can discard changes
       */
      formRef: RefObject<MetricAutomationFormHandle | null>;
      mode: 'edit';
      /**
       * Name edited outside the form, in the page header
       */
      name: string;
      onSaved: () => void;
      /**
       * Prevents editing until the user starts configuring
       */
      readOnly: boolean;
      /**
       * Reports whether any field differs from its saved value
       */
      setFormHasChanges: (hasChanges: boolean) => void;
      /**
       * Reports whether connected monitors are still loading or failed to load.
       * Saving then could drop service account projects that follow the monitors.
       */
      setMonitorsUnavailable: (unavailable: boolean) => void;
    };

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
  const readOnly = props.mode === 'edit' && props.readOnly;
  const createConfig = useCreateConfig();
  // Only called in edit mode, where the config ID is known
  const updateConfig = useUpdateConfig({
    configId: props.mode === 'edit' ? props.config.id : '',
  });
  const mutationError = props.mode === 'create' ? createConfig.error : updateConfig.error;
  const saveConfig = async (value: z.infer<typeof schema>) => {
    const fields = {
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
        enabled: value.enabled,
        strategy: 'breached_metric_investigation',
        name: value.name,
      });
      toast.success(t('Automation created.'));
      navigate(getAutomationDetailPath(organization.slug, config.id));
      return config;
    }
    // Pausing and resuming happen from the page header, so saving leaves `enabled`
    // alone. Sending it would also require access to every project the automation covers.
    const config = await updateConfig.mutateAsync({...fields, name: props.name});
    toast.success(t('Automation saved.'));
    props.onSaved();
    return config;
  };
  const form = useScrapsForm({
    ...defaultFormOptions,
    ...(props.mode === 'edit' ? {formId: props.formId} : {}),
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
    validators: {onDynamic: schema},
    onSubmit: async ({value, formApi}) => {
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
        toast.error(getRequestErrorUserMessage(error, t('Unable to save automation.')));
        if (error instanceof RequestError) {
          setFieldErrors(formApi, requestErrorToFieldErrors(error, formApi.state.values));
        }
      }
    },
  });
  const formRef = props.mode === 'edit' ? props.formRef : undefined;
  // Lets the page header's Cancel button discard changes from outside the form
  useImperativeHandle(formRef, () => ({reset: () => form.reset()}), [form]);
  const hasChanges = useStore(form.store, state => !state.isDefaultValue);
  const setFormHasChanges = props.mode === 'edit' ? props.setFormHasChanges : undefined;
  useEffect(() => setFormHasChanges?.(hasChanges), [setFormHasChanges, hasChanges]);
  // Fetch connected monitors by ID so they resolve regardless of the picker's filters
  const queryClient = useQueryClient();
  const monitorIds = useStore(form.store, state => state.values.monitorIds);
  const monitorsQueryOptions = detectorListApiOptions(organization, {
    ids: monitorIds,
    projects: [-1],
    limit: 100,
  });
  const monitorsQuery = useQuery({
    ...monitorsQueryOptions,
    enabled: monitorIds.length > 0,
    // Show monitors already fetched by the picker or an earlier lookup while
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
  const monitorsUnavailable = isResolvingMonitors || hasMonitorsError;
  const setMonitorsUnavailable =
    props.mode === 'edit' ? props.setMonitorsUnavailable : undefined;
  useEffect(
    () => setMonitorsUnavailable?.(monitorsUnavailable),
    [setMonitorsUnavailable, monitorsUnavailable]
  );
  // For typing
  const monitors =
    monitorIds.length > 0
      ? (monitorsQuery.data?.filter(monitor => monitor.type === 'metric_issue') ?? [])
      : [];

  return (
    <Container maxWidth="960px" width="100%" containerType="inline-size">
      <form.AppForm form={form}>
        <Stack gap="lg">
          {mutationError && (
            <Alert variant="danger">
              {getRequestErrorUserMessage(mutationError, t('Unable to save automation.'))}
            </Alert>
          )}
          <form.FieldGroup title={t('Description')}>
            {props.mode === 'create' && (
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
            <form.AppField name="monitorIds">
              {field => (
                <field.Layout.Stack
                  label={t('Connected monitors')}
                  hintText={t(
                    'Seer investigates when any of these metric monitors breaches.'
                  )}
                >
                  <field.Base>
                    {() => (
                      <ConnectedMonitors
                        monitorIds={field.state.value}
                        monitors={monitors}
                        isPending={monitorsQuery.isLoading}
                        isError={hasMonitorsError}
                        disabled={readOnly}
                        onChange={field.handleChange}
                      />
                    )}
                  </field.Base>
                </field.Layout.Stack>
              )}
            </form.AppField>
          </form.FieldGroup>

          <form.FieldGroup title={t('Actions')}>
            {/* Not configurable yet, so these show the fixed behavior */}
            <DisplayField.Row
              label={t('Start investigations')}
              hintText={t('Automatically investigate connected monitor breaches.')}
            >
              <Switch checked disabled aria-label={t('Start investigations')} />
            </DisplayField.Row>
            <DisplayField.Row
              label={t('Send notifications')}
              hintText={t('Post findings to alert targets of the connected monitors')}
            >
              <Switch checked disabled aria-label={t('Send notifications')} />
            </DisplayField.Row>
          </form.FieldGroup>

          <form.FieldGroup title={t('Service account capabilities')}>
            <Stack gap="lg">
              <Text variant="muted">
                {t(
                  "Choose what this automation's service account can access during an investigation."
                )}
              </Text>
              <form.AppField name="serviceAccountProjects">
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
                        disabled={readOnly || field.state.value.mode === 'all'}
                        value={resolveServiceAccountProjects(
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
                            : t('Project access is independent of connected monitors.')}
                        </Text>
                        {field.state.value.mode !== 'monitors' && (
                          <Button
                            size="xs"
                            disabled={readOnly}
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
              <form.AppField name="scopes">
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
                      disabled={readOnly}
                      value={field.state.value}
                      onChange={field.handleChange}
                      options={[...new Set([...availableScopes, ...field.state.value])]
                        .sort()
                        .map(scope => ({value: scope, label: scope}))}
                    />
                  </field.Layout.Stack>
                )}
              </form.AppField>
            </Stack>
          </form.FieldGroup>

          <Flex align="center" justify="between" gap="lg" wrap="wrap">
            <Text variant="muted" size="sm">
              {t('Changes apply when you save.')}
            </Text>
            {props.mode === 'create' && (
              <Flex gap="md">
                <LinkButton to={getAutomationsPath(organization.slug)}>
                  {t('Cancel')}
                </LinkButton>
                <form.SubmitButton
                  variant="primary"
                  disabled={isResolvingMonitors || hasMonitorsError}
                >
                  {t('Create automation')}
                </form.SubmitButton>
              </Flex>
            )}
          </Flex>
        </Stack>
      </form.AppForm>
    </Container>
  );
}

function ConnectedMonitors({
  monitorIds,
  monitors,
  isPending,
  isError,
  disabled,
  onChange,
}: {
  disabled: boolean;
  isError: boolean;
  isPending: boolean;
  monitorIds: string[];
  monitors: MetricDetector[];
  onChange: (monitorIds: string[]) => void;
}) {
  const {openDrawer} = useDrawer();
  const selected = monitors.filter(monitor => monitorIds.includes(monitor.id));
  const projectCount = new Set(selected.map(monitor => monitor.projectId)).size;

  return (
    <Stack gap="md" width="100%" minWidth={0} containerType="inline-size">
      <Flex align="center" justify="between" gap="md">
        <Text size="sm" variant="muted">
          {monitorIds.length === 0
            ? t('No monitors connected')
            : `${tn('%s monitor connected', '%s monitors connected', monitorIds.length)} · ${tn('%s project', '%s projects', projectCount)}`}
        </Text>
        <Button
          size="sm"
          icon={<IconAdd />}
          disabled={disabled}
          onClick={() =>
            openDrawer(
              () => (
                <ConnectMonitorsDrawer
                  initialMonitorIds={monitorIds}
                  onChange={onChange}
                />
              ),
              {
                ariaLabel: t('Connect monitors'),
                drawerKey: 'seer-automation-connect-monitors',
                drawerWidth: '70%',
              }
            )
          }
        >
          {t('Connect monitors')}
        </Button>
      </Flex>
      <MonitorTable
        monitors={selected}
        isError={isError}
        pendingRows={isPending ? monitorIds.length : 0}
        emptyMessage={t(
          'Connect a metric monitor, or save now and choose monitors later.'
        )}
        renderAction={monitor => (
          <Button
            size="xs"
            variant="transparent"
            icon={<IconClose />}
            aria-label={t('Disconnect %s', monitor.name)}
            disabled={disabled}
            onClick={() => onChange(monitorIds.filter(id => id !== monitor.id))}
          />
        )}
      />
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
