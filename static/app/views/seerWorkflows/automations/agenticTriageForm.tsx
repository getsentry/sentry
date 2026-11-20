import {useEffect, useImperativeHandle, type RefObject} from 'react';
import {IconFire} from '@sentry/icons/fire';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
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

import {t} from 'sentry/locale';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {STRATEGY_META} from 'sentry/views/seerWorkflows/strategies';
import type {
  SeerServiceAccountResponse,
  SeerWorkflowConfigResponse,
} from 'sentry/views/seerWorkflows/types';
import {
  getAutomationDetailPath,
  getAutomationsPath,
} from 'sentry/views/seerWorkflows/utils';

import {useCreateConfig, useUpdateConfig} from './hooks/configs';
import {FormSection, type MetricAutomationFormHandle} from './metricAutomationForm';
import {
  getServiceAccountProjectIds,
  ProjectSelector,
  ServiceAccountPermissions,
  ServiceAccountSummary,
  useHasAllProjectsAccess,
  type ProjectSelection,
  type ServiceAccountProjectAccess,
} from './serviceAccountAccess';

/**
 * A scope with no projects is only valid for users who can't choose any
 */
function getSchema(allowNoProjects: boolean) {
  return z.object({
    name: z.string().trim().min(1, t('Give your automation a name.')).max(64),
    enabled: z.boolean(),
    projects: z
      .object({
        allProjects: z.boolean(),
        projectIds: z.array(z.string()),
      })
      .refine(
        projects =>
          allowNoProjects || projects.allProjects || projects.projectIds.length > 0,
        {message: t('Choose at least one project.')}
      ),
    serviceAccountProjects: z.object({
      allProjects: z.boolean(),
      projectIds: z.array(z.string()),
    }),
    scopes: z
      .array(z.string())
      .min(1, t('Give the service account at least one permission.')),
  });
}

/**
 * Stands for every project in a config's project list
 */
const ALL_PROJECTS_ID = -1;

const DEFAULT_SERVICE_ACCOUNT_SCOPES = [
  'event:read',
  'member:read',
  'org:read',
  'project:read',
  'team:read',
];

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
    };

export function AgenticTriageForm(props: Props) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const serviceAccount = props.mode === 'edit' ? props.config.serviceAccount : null;
  const grantableScopes = new Set<string>(organization.access);
  const readOnly = props.mode === 'edit' && props.readOnly;
  const hasAllProjectsAccess = useHasAllProjectsAccess();
  const {projects} = useProjects();
  const firstProject = projects
    .filter(project => project.hasAccess)
    .sort((a, b) => a.slug.localeCompare(b.slug))[0];
  const hasNoProjects = !hasAllProjectsAccess && !firstProject;
  const schema = getSchema(hasNoProjects);
  // All projects when the user can grant them, otherwise their first project
  let defaultProjects: ProjectSelection = {
    allProjects: hasAllProjectsAccess,
    projectIds: !hasAllProjectsAccess && firstProject ? [firstProject.id] : [],
  };
  if (props.mode === 'edit') {
    defaultProjects = getProjectSelection(props.config.projects);
  }
  const createConfig = useCreateConfig();
  // Only called in edit mode, where the config ID is known
  const updateConfig = useUpdateConfig({
    configId: props.mode === 'edit' ? props.config.id : '',
  });
  const mutationError = props.mode === 'create' ? createConfig.error : updateConfig.error;
  const saveConfig = async (value: z.infer<ReturnType<typeof getSchema>>) => {
    const fields = {
      projectIds: value.projects.allProjects
        ? [ALL_PROJECTS_ID]
        : value.projects.projectIds.map(Number),
      serviceAccount: {
        scopes: value.scopes,
        projectIds: getServiceAccountProjectIds(value.serviceAccountProjects).map(Number),
        allProjects: value.serviceAccountProjects.allProjects,
      },
    };
    if (props.mode === 'create') {
      const config = await createConfig.mutateAsync({
        ...fields,
        enabled: value.enabled,
        strategy: 'agentic_triage_v2',
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
          ? t('Agentic Triage')
          : (props.config.name ?? STRATEGY_META.agentic_triage_v2.label),
      projects: defaultProjects,
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
            projects: getProjectSelection(config.projects),
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
                <Text variant="muted">{STRATEGY_META.agentic_triage_v2.description}</Text>
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
              <form.AppField name="projects">
                {field => (
                  <field.Layout.Stack
                    label={t('Projects')}
                    hintText={t('Seer triages issues in these projects.')}
                  >
                    <field.Base>
                      {() => (
                        <ProjectSelector
                          value={field.state.value}
                          disabled={readOnly}
                          onChange={field.handleChange}
                          emptyMessage={
                            hasNoProjects
                              ? t('No projects')
                              : t('Add projects for this automation to triage.')
                          }
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
                                      'Add the projects this automation should be able to look into.'
                                    )}
                                  </Text>
                                  <ProjectSelector
                                    value={field.state.value}
                                    disabled={readOnly}
                                    onChange={field.handleChange}
                                    emptyMessage={t(
                                      'Add a project to give the service account access.'
                                    )}
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
                <form.SubmitButton variant="primary">
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

function getProjectSelection(projectIds: number[]): ProjectSelection {
  const allProjects = projectIds.includes(ALL_PROJECTS_ID);
  return {allProjects, projectIds: allProjects ? [] : projectIds.map(String)};
}

function getServiceAccountProjectSelection(
  serviceAccount: SeerServiceAccountResponse | null
): ServiceAccountProjectAccess {
  return {
    allProjects: serviceAccount?.allProjects ?? false,
    projectIds: serviceAccount?.projectIds.map(String) ?? [],
  };
}
