import {useEffect, useImperativeHandle} from 'react';
import {IconAdd} from '@sentry/icons/add';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {
  ScrapsForm,
  defaultFormValidators,
  DisplayField,
  useScrapsForm,
  useSelector,
} from '@sentry/scraps/form';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Select} from '@sentry/scraps/select';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {timezoneOptions} from 'sentry/data/timezones';
import {t, tct} from 'sentry/locale';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {STRATEGY_META} from 'sentry/views/seerWorkflows/strategies';
import {
  getAutomationDetailPath,
  getAutomationsPath,
} from 'sentry/views/seerWorkflows/utils';

import {useCreateConfig, useUpdateConfig} from './hooks/configs';
import {
  FormSection,
  type CreateAutomationFormProps,
  type EditAutomationFormProps,
} from './baseForm';
import {hasDuplicateCrontabs, isValidCrontab, ScheduleField} from './scheduleField';
import {
  DEFAULT_SERVICE_ACCOUNT_SCOPES,
  getServiceAccountProjectIds,
  getServiceAccountProjectSelection,
  ProjectSelector,
  ServiceAccountPermissions,
  ServiceAccountSummary,
  useHasAllProjectsAccess,
  type ProjectSelection,
} from './serviceAccountAccess';

/**
 * The most schedules one automation can run on
 */
const MAX_SCHEDULES = 5;

const schema = z.object({
  name: z.string().trim().min(1, t('Give your automation a name.')).max(64),
  enabled: z.boolean(),
  crontabs: z
    .array(
      z
        .string()
        .trim()
        .refine(isValidCrontab, {
          message: t('Enter a valid crontab schedule, e.g. 0 0 * * *'),
        })
    )
    .min(1)
    .max(MAX_SCHEDULES),
  /**
   * IANA name that every schedule is evaluated in
   */
  timezone: z.string(),
  projects: z
    .object({allProjects: z.boolean(), projectIds: z.array(z.string())})
    .refine(projects => projects.allProjects || projects.projectIds.length > 0, {
      message: t('Choose at least one project.'),
    }),
  /**
   * Empty means all environments
   */
  environment: z.string(),
  serviceAccountProjects: z.object({
    allProjects: z.boolean(),
    projectIds: z.array(z.string()),
  }),
  scopes: z
    .array(z.string())
    .min(1, t('Give the service account at least one permission.')),
});

/**
 * Every day at midnight
 */
const DEFAULT_CRONTAB = '0 0 * * *';

const ENVIRONMENTS = ['production', 'staging', 'development'];

/**
 * Select value for all environments, since the select shows an empty value as unset
 */
const ALL_ENVIRONMENTS = '__all__';

export function ScheduledInvestigationForm(
  props: CreateAutomationFormProps | EditAutomationFormProps
) {
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

  // All projects when the user can grant them, otherwise their first project
  const defaultProjects: ProjectSelection =
    props.mode === 'edit'
      ? getProjectSelection(props.config.projects)
      : {
          allProjects: hasAllProjectsAccess,
          projectIds: !hasAllProjectsAccess && firstProject ? [firstProject.id] : [],
        };

  // Keeps a saved environment outside the presets selectable
  const currEnvironment =
    props.mode === 'edit' ? (props.config.environments[0] ?? '') : '';
  const environmentOptions =
    !currEnvironment || ENVIRONMENTS.includes(currEnvironment)
      ? ENVIRONMENTS
      : [...ENVIRONMENTS, currEnvironment];

  // Mutations
  const createConfig = useCreateConfig();
  const updateConfig = useUpdateConfig({
    configId: props.mode === 'edit' ? props.config.id : '',
  });
  const mutationError = props.mode === 'create' ? createConfig.error : updateConfig.error;
  const saveConfig = async (value: z.infer<typeof schema>) => {
    const fields = {
      cronSchedules: value.crontabs.map(crontab => ({crontab, timezone: value.timezone})),
      projectIds: value.projects.allProjects
        ? [ALL_ACCESS_PROJECTS]
        : value.projects.projectIds.map(Number),
      serviceAccount: {
        scopes: value.scopes,
        // An automation scoped to all projects needs a service account that reaches them
        projectIds: getServiceAccountProjectIds(
          value.serviceAccountProjects,
          value.projects
        ).map(Number),
        allProjects:
          value.projects.allProjects || value.serviceAccountProjects.allProjects,
      },
    };
    const environments = value.environment ? [value.environment] : [];
    if (props.mode === 'create') {
      const config = await createConfig.mutateAsync({
        ...fields,
        environments,
        enabled: value.enabled,
        strategy: 'scheduled_investigation',
        name: value.name,
      });
      toast.success(t('Automation created.'));
      navigate(getAutomationDetailPath(organization.slug, config.id));
      return config;
    }
    const config = await updateConfig.mutateAsync({
      ...fields,
      environments,
      name: props.name,
    });
    toast.success(t('Automation saved.'));
    props.onSaved();
    return config;
  };

  const form = useScrapsForm({
    ...(props.mode === 'edit' ? {formId: props.formId} : {}),
    defaultValues: {
      enabled: props.mode === 'edit' ? props.config.enabled : false,
      name:
        props.mode === 'create'
          ? t('Scheduled Investigation')
          : (props.config.name ?? STRATEGY_META.scheduled_investigation.label),
      crontabs: [DEFAULT_CRONTAB],
      timezone: 'UTC',
      projects: defaultProjects,
      environment: currEnvironment,
      serviceAccountProjects: getServiceAccountProjectSelection(serviceAccount),
      scopes:
        serviceAccount?.scopes ??
        DEFAULT_SERVICE_ACCOUNT_SCOPES.filter(scope => grantableScopes.has(scope)),
    },
    validators: defaultFormValidators(schema),
    onSubmit: async ({value, formApi, createValidationError}) => {
      if (hasDuplicateCrontabs(value.crontabs)) {
        toast.error(t('Each crontab must be different. Remove the duplicates to save.'));
        return;
      }
      try {
        const config = await saveConfig(schema.parse(value));
        if (props.mode === 'edit') {
          formApi.reset({
            name: value.name,
            enabled: config.enabled,
            crontabs: value.crontabs,
            timezone: value.timezone,
            projects: getProjectSelection(config.projects),
            environment: config.environments[0] ?? '',
            serviceAccountProjects: getServiceAccountProjectSelection(
              config.serviceAccount
            ),
            scopes: config.serviceAccount?.scopes ?? value.scopes,
          });
        }
      } catch (error) {
        toast.error(getRequestErrorUserMessage(error, t('Unable to save automation.')));
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
  const formRef = props.mode === 'edit' ? props.formRef : undefined;
  // Lets the page header's Cancel button discard changes from outside the form
  useImperativeHandle(formRef, () => ({reset: () => form.reset()}), [form]);
  const hasChanges = useSelector(form.atom, state => !state.isDefaultValue);
  const setFormHasChanges = props.mode === 'edit' ? props.setFormHasChanges : undefined;
  useEffect(() => setFormHasChanges?.(hasChanges), [setFormHasChanges, hasChanges]);

  const serviceAccountProjects = useSelector(
    form.atom,
    state => state.values.serviceAccountProjects
  );
  const scopes = useSelector(form.atom, state => state.values.scopes);
  // Projects in the automation's scope are always granted to its service account
  const scopeProjects = useSelector(form.atom, state => state.values.projects);
  const scopeProjectIds = scopeProjects.allProjects ? [] : scopeProjects.projectIds;

  return (
    <Container maxWidth="960px" width="100%" containerType="inline-size">
      <ScrapsForm form={form}>
        <Stack gap="lg">
          {mutationError && (
            <Alert variant="danger">
              {getRequestErrorUserMessage(mutationError, t('Unable to save automation.'))}
            </Alert>
          )}
          <FormSection title={t('Description')}>
            <form.FieldGroup>
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
                  {STRATEGY_META.scheduled_investigation.description}
                </Text>
              </Container>
            </form.FieldGroup>
          </FormSection>

          <FormSection title={t('Trigger')}>
            <form.FieldGroup>
              <form.ArrayField name="crontabs">
                {field => {
                  const atMax = field.value.length >= MAX_SCHEDULES;
                  return (
                    <DisplayField.Row
                      label={t('Schedule')}
                      hintText={tct(
                        'Runs on a schedule. Use [link:the crontab syntax].',
                        {link: <ExternalLink href="https://en.wikipedia.org/wiki/Cron" />}
                      )}
                    >
                      <Stack gap="md" flexGrow={1}>
                        {field.value.map((_, index) => (
                          <form.Field key={index} name={`crontabs[${index}]`}>
                            {crontabField => (
                              <crontabField.Base<HTMLInputElement>>
                                {({disabled: _disabled, ...inputProps}) => (
                                  <ScheduleField
                                    value={crontabField.value}
                                    onChange={crontabField.handleChange}
                                    onRemove={() => field.removeValue(index)}
                                    // An automation always has at least one schedule
                                    canRemove={field.value.length > 1}
                                    disabled={readOnly}
                                    inputProps={inputProps}
                                  />
                                )}
                              </crontabField.Base>
                            )}
                          </form.Field>
                        ))}
                        <Grid columns="minmax(0, 1fr) max-content" gap="md">
                          <form.Field name="timezone">
                            {timezoneField => (
                              <timezoneField.Base>
                                {() => (
                                  <Stack width="100%">
                                    <Select
                                      aria-label={t('Timezone')}
                                      value={timezoneField.value}
                                      options={timezoneOptions}
                                      disabled={readOnly}
                                      onChange={option =>
                                        timezoneField.handleChange(option.value)
                                      }
                                    />
                                  </Stack>
                                )}
                              </timezoneField.Base>
                            )}
                          </form.Field>
                          <Button
                            aria-label={t('Add schedule')}
                            icon={<IconAdd />}
                            disabled={readOnly || atMax}
                            tooltipProps={{
                              title: atMax
                                ? t('You have reached the maximum number of crontabs.')
                                : t('Add a crontab'),
                            }}
                            onClick={() => field.pushValue(DEFAULT_CRONTAB)}
                          />
                        </Grid>
                      </Stack>
                    </DisplayField.Row>
                  );
                }}
              </form.ArrayField>
            </form.FieldGroup>
          </FormSection>

          <FormSection title={t('Scope')}>
            <form.FieldGroup>
              <form.Field name="projects">
                {field => (
                  <field.Layout.Stack
                    label={t('Projects')}
                    hintText={t('Seer investigates issues in these projects.')}
                  >
                    <field.Base>
                      {() => (
                        <ProjectSelector
                          value={field.value}
                          showReason={false}
                          disabled={readOnly}
                          onChange={next => {
                            // A project leaves the grant when it leaves the scope
                            const dropped = new Set(
                              scopeProjectIds.filter(
                                id => next.allProjects || !next.projectIds.includes(id)
                              )
                            );
                            if (dropped.size > 0) {
                              form.setFieldValue('serviceAccountProjects', {
                                ...serviceAccountProjects,
                                projectIds: serviceAccountProjects.projectIds.filter(
                                  id => !dropped.has(id)
                                ),
                              });
                            }
                            field.handleChange(next);
                          }}
                          emptyMessage={
                            firstProject
                              ? t('Add projects for this automation to investigate.')
                              : t('You do not have access to any projects.')
                          }
                        />
                      )}
                    </field.Base>
                  </field.Layout.Stack>
                )}
              </form.Field>
              <form.Field name="environment">
                {field => (
                  <field.Layout.Row label={t('Environments')}>
                    <field.Select
                      value={field.value || ALL_ENVIRONMENTS}
                      onChange={value =>
                        field.handleChange(value === ALL_ENVIRONMENTS ? '' : value)
                      }
                      disabled={readOnly}
                      options={[
                        {value: ALL_ENVIRONMENTS, label: t('All environments')},
                        ...environmentOptions.map(environment => ({
                          value: environment,
                          label: environment,
                        })),
                      ]}
                    />
                  </field.Layout.Row>
                )}
              </form.Field>
            </form.FieldGroup>
          </FormSection>

          <FormSection title={t('Actions')}>
            <form.FieldGroup>
              {/* Not configurable yet, so this shows the fixed behavior */}
              <DisplayField.Row
                label={t('Start investigations')}
                hintText={t('(mock) Automatically investigate new issues')}
              >
                <Switch checked disabled aria-label={t('Start investigations')} />
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
                      scopeProjects={scopeProjects}
                      scopes={scopes}
                    />
                  </Disclosure.Title>
                  <Disclosure.Content>
                    <Stack gap="2xl" paddingTop="md">
                      <form.Field name="serviceAccountProjects">
                        {field => (
                          <field.Layout.Stack label={t('Project access')}>
                            <field.Base>
                              {() => (
                                <Stack gap="lg" width="100%">
                                  <Text size="sm" variant="muted">
                                    {t(
                                      'Projects in the automation scope are always included. Add any others an investigation should look into, like upstream services.'
                                    )}
                                  </Text>
                                  <ProjectSelector
                                    value={field.value}
                                    scopeProjects={scopeProjects}
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
                      </form.Field>
                      <Container borderTop="primary" paddingTop="2xl">
                        <form.Field name="scopes">
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
                                      value={field.value}
                                      disabled={readOnly}
                                      onChange={field.handleChange}
                                    />
                                  </Stack>
                                )}
                              </field.Base>
                            </field.Layout.Stack>
                          )}
                        </form.Field>
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
      </ScrapsForm>
    </Container>
  );
}

function getProjectSelection(projectIds: number[]): ProjectSelection {
  const allProjects = projectIds.includes(ALL_ACCESS_PROJECTS);
  return {allProjects, projectIds: allProjects ? [] : projectIds.map(String)};
}
