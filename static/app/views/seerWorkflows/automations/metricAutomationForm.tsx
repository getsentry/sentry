import {useEffect, useImperativeHandle, type ReactNode, type RefObject} from 'react';
import {IconAdd} from '@sentry/icons/add';
import {IconClose} from '@sentry/icons/close';
import {IconFire} from '@sentry/icons/fire';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
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
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {t, tn} from 'sentry/locale';
import type {Detector, MetricDetector} from 'sentry/types/workflowEngine/detectors';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
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
import {
  getServiceAccountProjectIds,
  ServiceAccountPermissions,
  ServiceAccountProjects,
  ServiceAccountSummary,
  type ServiceAccountProjectAccess,
} from './serviceAccountAccess';

const schema = z.object({
  name: z.string().trim().min(1, t('Give your automation a name.')).max(64),
  enabled: z.boolean(),
  monitorIds: z.array(z.string()),
  serviceAccountProjects: z.object({
    allProjects: z.boolean(),
    projectIds: z.array(z.string()),
  }),
  scopes: z
    .array(z.string())
    .min(1, t('Give the service account at least one permission.')),
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
       * Disables save while monitors are loading
       */
      setMonitorsPending: (pending: boolean) => void;
    };

export function MetricAutomationForm(props: Props) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const serviceAccount = props.mode === 'edit' ? props.config.serviceAccount : null;
  const grantableScopes = new Set<string>(organization.access);
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
        projectIds: getServiceAccountProjectIds(
          value.serviceAccountProjects,
          monitors.filter(monitor => value.monitorIds.includes(monitor.id))
        ).map(Number),
        allProjects: value.serviceAccountProjects.allProjects,
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
  const setMonitorsPending = props.mode === 'edit' ? props.setMonitorsPending : undefined;
  useEffect(
    () => setMonitorsPending?.(isResolvingMonitors),
    [setMonitorsPending, isResolvingMonitors]
  );
  // For typing
  const monitors =
    monitorIds.length > 0
      ? (monitorsQuery.data?.filter(monitor => monitor.type === 'metric_issue') ?? [])
      : [];
  const connectedMonitors = monitors.filter(monitor => monitorIds.includes(monitor.id));
  const serviceAccountProjects = useStore(
    form.store,
    state => state.values.serviceAccountProjects
  );
  const scopes = useStore(form.store, state => state.values.scopes);

  return (
    <Container maxWidth="960px" width="100%" containerType="inline-size">
      <form.AppForm form={form}>
        <Stack gap="lg">
          {mutationError && (
            <Alert variant="danger">
              {getRequestErrorUserMessage(mutationError, t('Unable to save automation.'))}
            </Alert>
          )}
          <FormSection title={t('Description')}>
            <form.FieldGroup>
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
          </FormSection>

          <FormSection title={t('Trigger')}>
            <form.FieldGroup>
              <DisplayField.Row
                label={t('Metric breach')}
                hintText={t(
                  'Runs when any connected monitor crosses its alert threshold.'
                )}
              >
                <Flex>
                  <Tag icon={<IconFire />} variant="muted">
                    {t('When a monitor breaches')}
                  </Tag>
                </Flex>
              </DisplayField.Row>
            </form.FieldGroup>
          </FormSection>

          <FormSection title={t('Scope')}>
            <form.FieldGroup>
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
                          onChange={next => {
                            const remaining = new Set(
                              monitors
                                .filter(monitor => next.includes(monitor.id))
                                .map(monitor => monitor.projectId)
                            );
                            // A project leaves the grant with its last connected monitor
                            const dropped = new Set(
                              connectedMonitors
                                .map(monitor => monitor.projectId)
                                .filter(projectId => !remaining.has(projectId))
                            );
                            if (dropped.size > 0) {
                              form.setFieldValue('serviceAccountProjects', {
                                ...serviceAccountProjects,
                                projectIds: serviceAccountProjects.projectIds.filter(
                                  projectId => !dropped.has(projectId)
                                ),
                              });
                            }
                            field.handleChange(next);
                          }}
                        />
                      )}
                    </field.Base>
                  </field.Layout.Stack>
                )}
              </form.AppField>
            </form.FieldGroup>
          </FormSection>

          <FormSection title={t('Actions')}>
            <form.FieldGroup>
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
          </FormSection>

          <FormSection title={t('Service account')}>
            <form.FieldGroup>
              <Stack gap="lg">
                <Text variant="muted">
                  {t(
                    'Investigations run as a service account that belongs to this automation. It can only reach the projects and permissions it is given.'
                  )}
                </Text>
                <Disclosure>
                  <Disclosure.Title>
                    <ServiceAccountSummary
                      access={serviceAccountProjects}
                      monitors={connectedMonitors}
                      scopes={scopes}
                    />
                  </Disclosure.Title>
                  <Disclosure.Content>
                    <Stack gap="2xl" paddingTop="md">
                      <form.AppField name="serviceAccountProjects">
                        {field => (
                          <field.Layout.Stack label={t('Project access')}>
                            <field.Base>
                              {() => (
                                <Stack gap="lg" width="100%">
                                  <Text size="sm" variant="muted">
                                    {t(
                                      'Projects with a connected monitor are always included. Add any others an investigation should look into, like upstream services.'
                                    )}
                                  </Text>
                                  <ServiceAccountProjects
                                    value={field.state.value}
                                    monitors={connectedMonitors}
                                    disabled={readOnly}
                                    onChange={field.handleChange}
                                  />
                                </Stack>
                              )}
                            </field.Base>
                          </field.Layout.Stack>
                        )}
                      </form.AppField>
                      <Container borderTop="primary" paddingTop="2xl">
                        <form.AppField name="scopes">
                          {field => (
                            <field.Layout.Stack label={t('Permissions')}>
                              <field.Base>
                                {() => (
                                  <Stack gap="lg" width="100%">
                                    <Text size="sm" variant="muted">
                                      {t(
                                        'Read access is enough to investigate. Grant write access only for the actions you want this automation to take.'
                                      )}
                                    </Text>
                                    <ServiceAccountPermissions
                                      value={field.state.value}
                                      disabled={readOnly}
                                      onChange={field.handleChange}
                                    />
                                  </Stack>
                                )}
                              </field.Base>
                            </field.Layout.Stack>
                          )}
                        </form.AppField>
                      </Container>
                    </Stack>
                  </Disclosure.Content>
                </Disclosure>
              </Stack>
            </form.FieldGroup>
          </FormSection>

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

function FormSection({title, children}: {children: ReactNode; title: string}) {
  return (
    <Stack gap="md">
      <Container paddingLeft="md">
        <Heading as="h2" size="lg">
          {title}
        </Heading>
      </Container>
      {children}
    </Stack>
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
): ServiceAccountProjectAccess {
  return {
    allProjects: serviceAccount?.allProjects ?? false,
    projectIds: serviceAccount?.projectIds.map(String) ?? [],
  };
}
