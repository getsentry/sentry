import {useCallback, useMemo} from 'react';
import {useMutation} from '@tanstack/react-query';
import {PlatformIcon} from 'platformicons';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/code';
import {
  AutoSaveForm,
  defaultFormOptions,
  FieldGroup,
  FormSearch,
  setFieldErrors,
  useScrapsForm,
} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {
  changeProjectSlug,
  removeProject,
  transferProject,
} from 'sentry/actionCreators/projects';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Confirm} from 'sentry/components/confirm';
import {createFilter} from 'sentry/components/forms/controls/reactSelectWrapper';
import {FieldGroup as SettingsFieldGroup} from 'sentry/components/forms/fieldGroup';
import {TextField} from 'sentry/components/forms/fields/textField';
import {Form} from 'sentry/components/forms/form';
import type {FieldValue} from 'sentry/components/forms/model';
import {Hovercard} from 'sentry/components/hovercard';
import {LoadingError} from 'sentry/components/loadingError';
import {Override} from 'sentry/components/override';
import {removePageFiltersStorage} from 'sentry/components/pageFilters/persistence';
import {Panel} from 'sentry/components/panels/panel';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {consoles} from 'sentry/data/platformCategories';
import {allPlatforms as platforms} from 'sentry/data/platforms';
import {t, tct, tn} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/platform';
import type {DetailedProject} from 'sentry/types/project';
import {convertMultilineFieldValue, extractMultilineFields} from 'sentry/utils';
import {getDynamicText} from 'sentry/utils/getDynamicText';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {useUpdateProjectMutationOptions} from 'sentry/utils/project/useUpdateProject';
import {recreateRoute} from 'sentry/utils/recreateRoute';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {slugify} from 'sentry/utils/slugify';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {TextBlock} from 'sentry/views/settings/components/text/textBlock';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

type Props = {
  onChangeSlug: (slug: string) => void;
  project: DetailedProject;
};

const ORG_DISABLED_REASON = t(
  "This option is enforced by your organization's settings and cannot be customized per-project."
);

const INHERIT_DEBUG_FILES_ROLE = '__inherit__';

function getResolveAgeAllowedValues() {
  let i = 0;
  const values: number[] = [];
  while (i <= 720) {
    values.push(i);
    if (i < 12) {
      i += 1;
    } else if (i < 24) {
      i += 3;
    } else if (i < 36) {
      i += 6;
    } else if (i < 48) {
      i += 12;
    } else {
      i += 24;
    }
  }
  return values;
}

const RESOLVE_AGE_ALLOWED_VALUES = getResolveAgeAllowedValues();

function formatResolveAge(value: number): string {
  if (!value) {
    return t('Disabled');
  }
  if (value > 23 && value % 24 === 0) {
    return tn('%s day', '%s days', value / 24);
  }
  return tn('%s hour', '%s hours', value);
}

function isPlatformAllowed({
  isSelfHosted,
  platform,
  organization,
}: {
  isSelfHosted: boolean;
  organization: Organization;
  platform: PlatformKey;
}) {
  if (!consoles.includes(platform)) {
    return true;
  }

  return organization.enabledConsolePlatforms?.includes(platform) && !isSelfHosted;
}

const slugSchema = z.object({
  slug: z.string().min(1, t('Slug is required')),
});

const projectIdSchema = z.object({
  projectId: z.string(),
});

const resolveAgeSchema = z.object({
  resolveAge: z.number(),
});

const securityTokenSchema = z.object({
  securityToken: z.string(),
});

const securityTokenHeaderSchema = z.object({
  securityTokenHeader: z.string(),
});

const projectSettingsSchema = z.object({
  // The full platform list is large, so skip the enum and just carry the
  // PlatformKey type rather than a plain string.
  platform: z.custom<PlatformKey>().optional(),
  subjectPrefix: z.string(),
  allowedDomains: z.string(),
  scrapeJavaScript: z.boolean(),
  enableAutoReleaseCreation: z.boolean(),
  scmSourceContextEnabled: z.boolean(),
  verifySSL: z.boolean(),
  debugFilesRole: z.string().nullable(),
});

function ProjectSlugForm({
  project,
  disabled,
  onChangeSlug,
}: {
  disabled: boolean;
  onChangeSlug: (slug: string) => void;
  project: DetailedProject;
}) {
  const updateProject = useMutation(useUpdateProjectMutationOptions(project));

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {slug: project.slug},
    validators: {onDynamic: slugSchema},
    onSubmit: ({value, formApi}) =>
      updateProject
        .mutateAsync({slug: value.slug})
        .then(updatedProject => {
          if (project.slug !== updatedProject.slug) {
            changeProjectSlug(project.slug, updatedProject.slug);
            // Container will redirect after stores get updated with new slug
            onChangeSlug(updatedProject.slug);
          }
        })
        .catch(error => {
          if (error instanceof RequestError) {
            setFieldErrors(formApi, error);
          }
        }),
  });

  return (
    <form.AppForm form={form}>
      <FormSearch route="/settings/:orgId/projects/:projectId/">
        <form.AppField name="slug">
          {field => (
            <field.Layout.Row
              label={t('Slug')}
              hintText={t('A unique ID used to identify this project')}
              required
            >
              <field.Input
                value={field.state.value}
                onChange={value => field.handleChange(slugify(value))}
                disabled={disabled}
              />
            </field.Layout.Row>
          )}
        </form.AppField>

        {!disabled && (
          <form.Subscribe selector={state => !state.isDefaultValue}>
            {isDirty =>
              isDirty ? (
                <Container paddingTop="lg">
                  <Alert variant="warning">
                    {t(
                      "Changing a project's slug can break your build scripts! Please proceed carefully."
                    )}
                  </Alert>
                  <Flex gap="sm" justify="end" paddingTop="lg">
                    <form.ResetButton>{t('Cancel')}</form.ResetButton>
                    <form.SubmitButton>{t('Save')}</form.SubmitButton>
                  </Flex>
                </Container>
              ) : null
            }
          </form.Subscribe>
        )}
      </FormSearch>
    </form.AppForm>
  );
}

function ProjectIdField({project}: {project: DetailedProject}) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {projectId: project.id},
    validators: {onDynamic: projectIdSchema},
  });

  return (
    <form.AppForm form={form}>
      <form.AppField name="projectId">
        {field => (
          <field.Layout.Row
            label={t('Project ID')}
            hintText={t('The unique identifier for this project. It cannot be modified.')}
          >
            <field.Input
              value={field.state.value}
              onChange={field.handleChange}
              disabled
            />
          </field.Layout.Row>
        )}
      </form.AppField>
    </form.AppForm>
  );
}

function AutoResolveForm({
  project,
  disabled,
}: {
  disabled: boolean;
  project: DetailedProject;
}) {
  const updateProject = useMutation(useUpdateProjectMutationOptions(project));

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {resolveAge: project.resolveAge ?? 0},
    validators: {onDynamic: resolveAgeSchema},
    onSubmit: ({value, formApi}) =>
      updateProject
        .mutateAsync({resolveAge: value.resolveAge})
        .then(() => formApi.reset(value))
        .catch(error => {
          if (error instanceof RequestError) {
            setFieldErrors(formApi, error);
          }
        }),
  });

  return (
    <form.AppForm form={form}>
      <FormSearch route="/settings/:orgId/projects/:projectId/">
        <form.AppField name="resolveAge">
          {field => {
            const index = Math.max(
              0,
              RESOLVE_AGE_ALLOWED_VALUES.indexOf(field.state.value)
            );
            return (
              <field.Layout.Row
                label={t('Auto Resolve')}
                hintText={t(
                  "Automatically resolve an issue if it hasn't been seen for this amount of time"
                )}
              >
                <Stack gap="xs">
                  <Text variant="muted" bold>
                    {formatResolveAge(field.state.value)}
                  </Text>
                  <field.Range
                    aria-label={t('Auto Resolve')}
                    value={index}
                    onChange={newIndex =>
                      field.handleChange(RESOLVE_AGE_ALLOWED_VALUES[newIndex] ?? 0)
                    }
                    min={0}
                    max={RESOLVE_AGE_ALLOWED_VALUES.length - 1}
                    step={1}
                    formatOptions="hidden"
                    disabled={disabled}
                  />
                </Stack>
              </field.Layout.Row>
            );
          }}
        </form.AppField>

        {!disabled && (
          <form.Subscribe selector={state => !state.isDefaultValue}>
            {isDirty =>
              isDirty ? (
                <Container paddingTop="lg">
                  <Alert variant="warning">
                    {tct(
                      '[strong:Caution]: Enabling auto resolve will immediately resolve anything that has not been seen within this period of time. There is no undo!',
                      {strong: <strong />}
                    )}
                  </Alert>
                  <Flex gap="sm" justify="end" paddingTop="lg">
                    <form.ResetButton>{t('Cancel')}</form.ResetButton>
                    <form.SubmitButton>{t('Save')}</form.SubmitButton>
                  </Flex>
                </Container>
              ) : null
            }
          </form.Subscribe>
        )}
      </FormSearch>
    </form.AppForm>
  );
}

const SECURITY_TOKEN_HELP = t(
  'Outbound requests matching Allowed Domains will have the header "{token_header}: {token}" appended'
);

function SecurityTokenForm({
  project,
  disabled,
}: {
  disabled: boolean;
  project: DetailedProject;
}) {
  const updateProject = useMutation(useUpdateProjectMutationOptions(project));

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      securityToken: getDynamicText({
        value: project.securityToken ?? '',
        fixed: '__SECURITY_TOKEN__',
      }),
    },
    validators: {onDynamic: securityTokenSchema},
    onSubmit: ({value, formApi}) =>
      updateProject
        .mutateAsync({securityToken: value.securityToken})
        .then(() => formApi.reset(value))
        .catch(error => {
          if (error instanceof RequestError) {
            setFieldErrors(formApi, error);
          }
        }),
  });

  return (
    <form.AppForm form={form}>
      <FormSearch route="/settings/:orgId/projects/:projectId/">
        <form.AppField name="securityToken">
          {field => (
            <field.Layout.Row label={t('Security Token')} hintText={SECURITY_TOKEN_HELP}>
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                disabled={disabled}
              />
            </field.Layout.Row>
          )}
        </form.AppField>

        {!disabled && (
          <form.Subscribe selector={state => !state.isDefaultValue}>
            {isDirty =>
              isDirty ? (
                <Container paddingTop="lg">
                  <Alert variant="warning">
                    {t('Ensure you update usages of your security token.')}
                  </Alert>
                  <Flex gap="sm" justify="end" paddingTop="lg">
                    <form.ResetButton>{t('Cancel')}</form.ResetButton>
                    <form.SubmitButton>{t('Save')}</form.SubmitButton>
                  </Flex>
                </Container>
              ) : null
            }
          </form.Subscribe>
        )}
      </FormSearch>
    </form.AppForm>
  );
}

function SecurityTokenHeaderForm({
  project,
  disabled,
}: {
  disabled: boolean;
  project: DetailedProject;
}) {
  const updateProject = useMutation(useUpdateProjectMutationOptions(project));

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {securityTokenHeader: project.securityTokenHeader ?? ''},
    validators: {onDynamic: securityTokenHeaderSchema},
    onSubmit: ({value, formApi}) =>
      updateProject
        .mutateAsync({securityTokenHeader: value.securityTokenHeader})
        .then(() => formApi.reset(value))
        .catch(error => {
          if (error instanceof RequestError) {
            setFieldErrors(formApi, error);
          }
        }),
  });

  return (
    <form.AppForm form={form}>
      <FormSearch route="/settings/:orgId/projects/:projectId/">
        <form.AppField name="securityTokenHeader">
          {field => (
            <field.Layout.Row
              label={t('Security Token Header')}
              hintText={SECURITY_TOKEN_HELP}
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t('X-Sentry-Token')}
                disabled={disabled}
              />
            </field.Layout.Row>
          )}
        </form.AppField>

        {!disabled && (
          <form.Subscribe selector={state => !state.isDefaultValue}>
            {isDirty =>
              isDirty ? (
                <Container paddingTop="lg">
                  <Alert variant="warning">
                    {t('Ensure you update usages of the security token header.')}
                  </Alert>
                  <Flex gap="sm" justify="end" paddingTop="lg">
                    <form.ResetButton>{t('Cancel')}</form.ResetButton>
                    <form.SubmitButton>{t('Save')}</form.SubmitButton>
                  </Flex>
                </Container>
              ) : null
            }
          </form.Subscribe>
        )}
      </FormSearch>
    </form.AppForm>
  );
}

export function ProjectGeneralSettings({project, onChangeSlug}: Props) {
  const transferForm: Record<string, FieldValue> = {};
  const navigate = useNavigate();
  const {isSelfHosted} = useLegacyStore(ConfigStore);

  const organization = useOrganization();
  const api = useApi({persistInFlight: true});

  const disabled = !hasEveryAccess(['project:write'], {organization, project});

  const projectMutationOptions = useUpdateProjectMutationOptions(project);
  const updateProject = useMutation(projectMutationOptions);

  const handleTransferFieldChange = (id: string, value: FieldValue) => {
    transferForm[id] = value;
  };

  const handleRemoveProject = async () => {
    removePageFiltersStorage(organization.slug);

    if (!project) {
      return;
    }

    try {
      await removeProject({
        api,
        orgSlug: organization.slug,
        projectSlug: project.slug,
        origin: 'settings',
      });
    } catch (err) {
      addErrorMessage(tct('Error removing [project]', {project: project.slug}));
      throw err;
    }

    addSuccessMessage(tct('[project] was successfully removed', {project: project.slug}));
    navigate(`/settings/${organization.slug}/projects/`);
  };

  const handleTransferProject = async () => {
    if (!project) {
      return;
    }
    if (typeof transferForm.email !== 'string' || transferForm.email.length < 1) {
      return;
    }

    try {
      await transferProject(api, organization.slug, project, transferForm.email);
      // Need to hard reload because lots of components do not listen to Projects Store
      window.location.assign('/');
    } catch (err: any) {
      if (err.status >= 500) {
        handleXhrErrorResponse('Unable to transfer project', err);
      }
    }
  };

  const renderRemoveProject = () => {
    const isProjectAdmin = hasEveryAccess(['project:admin'], {
      organization,
      project,
    });
    const {isInternal} = project;

    return (
      <SettingsFieldGroup
        label={t('Remove Project')}
        help={tct(
          'Remove the [project] project and all related data. [linebreak] Careful, this action cannot be undone.',
          {
            project: <strong>{project.slug}</strong>,
            linebreak: <br />,
          }
        )}
      >
        {!isProjectAdmin &&
          t('You do not have the required permission to remove this project.')}

        {isInternal &&
          t(
            'This project cannot be removed. It is used internally by the Sentry server.'
          )}

        {isProjectAdmin && !isInternal && (
          <Confirm
            onConfirm={handleRemoveProject}
            priority="danger"
            confirmText={t('Remove Project')}
            message={
              <div>
                <TextBlock>
                  <strong>
                    {t('Removing this project is permanent and cannot be undone!')}
                  </strong>
                </TextBlock>
                <TextBlock>
                  {t('This will also remove all associated event data.')}
                </TextBlock>
              </div>
            }
          >
            <div>
              <Button variant="danger">{t('Remove Project')}</Button>
            </div>
          </Confirm>
        )}
      </SettingsFieldGroup>
    );
  };

  const renderTransferProject = () => {
    const {isInternal} = project;
    const isOrgOwner = hasEveryAccess(['org:admin'], {
      organization,
    });

    return (
      <SettingsFieldGroup
        label={t('Transfer Project')}
        help={tct(
          'Transfer the [project] project and all related data. [linebreak] Careful, this action cannot be undone.',
          {
            project: <strong>{project.slug}</strong>,
            linebreak: <br />,
          }
        )}
      >
        {!isOrgOwner &&
          t('You do not have the required permission to transfer this project.')}

        {isInternal &&
          t(
            'This project cannot be transferred. It is used internally by the Sentry server.'
          )}

        {isOrgOwner && !isInternal && (
          <Confirm
            onConfirm={() => {
              handleTransferProject();
            }}
            priority="danger"
            confirmText={t('Transfer project')}
            renderMessage={({confirm}) => (
              <div>
                <TextBlock>
                  <strong>
                    {t('Transferring this project is permanent and cannot be undone!')}
                  </strong>
                </TextBlock>
                <TextBlock>
                  {t(
                    'Please enter the email of an organization owner to whom you would like to transfer this project. Note: It is not possible to transfer projects between organizations in different regions.'
                  )}
                </TextBlock>
                <Panel>
                  <Form
                    hideFooter
                    onFieldChange={handleTransferFieldChange}
                    onSubmit={(_data, _onSuccess, _onError, e) => {
                      e.stopPropagation();
                      confirm();
                    }}
                  >
                    <TextField
                      name="email"
                      label={t('Organization Owner')}
                      placeholder="admin@example.com"
                      required
                      help={t(
                        'A request will be emailed to this address, asking the organization owner to accept the project transfer.'
                      )}
                    />
                  </Form>
                </Panel>
              </div>
            )}
          >
            <div>
              <Button variant="danger">{t('Transfer Project')}</Button>
            </div>
          </Confirm>
        )}
      </SettingsFieldGroup>
    );
  };

  const platformOptions = useMemo(
    () =>
      platforms
        .filter(
          ({id}) =>
            project.platform === id ||
            isPlatformAllowed({isSelfHosted, organization, platform: id})
        )
        .map(({id, name}) => ({
          value: id,
          label: (
            <Flex align="center" gap="md">
              <PlatformIcon platform={id} />
              {name}
            </Flex>
          ),
        })),
    [isSelfHosted, organization, project.platform]
  );

  const platformFilter = useMemo(
    () =>
      createFilter({
        stringify: option => {
          const matchedPlatform = platforms.find(({id}) => id === option.value);
          return `${matchedPlatform?.name} ${option.value}`;
        },
      }),
    []
  );

  const orgDebugFilesRoleName =
    organization.orgRoleList?.find(r => r.id === organization.debugFilesRole)?.name ??
    organization.debugFilesRole;
  const debugFilesRoleOptions = [
    {
      value: INHERIT_DEBUG_FILES_ROLE,
      label: tct('Inherit organization setting ([organizationValue])', {
        organizationValue: orgDebugFilesRoleName,
      }),
    },
    ...(organization.orgRoleList?.map(r => ({value: r.id, label: r.name})) ?? []),
  ];

  const orgScrapeJavaScript = Boolean(organization.scrapeJavaScript);

  const allowedDomainsHelp = tct('Separate multiple entries with a newline. [examples]', {
    examples: (
      <Hovercard
        body={
          <CodeBlock hideCopyButton>
            {'https://example.com\n*.example.com\n*:80\n*'}
          </CodeBlock>
        }
      >
        <Button variant="link" size="xs">
          {t('View Examples')}
        </Button>
      </Hovercard>
    ),
  });

  return (
    <div>
      <SentryDocumentTitle title={t('Project Settings')} projectSlug={project.slug} />
      <SettingsPageHeader title={t('Project Settings')} />
      <ProjectPermissionAlert project={project} />

      <FormSearch route="/settings/:orgId/projects/:projectId/">
        <FieldGroup title={t('Project Details')}>
          <ProjectSlugForm
            project={project}
            disabled={disabled}
            onChangeSlug={onChangeSlug}
          />

          <ProjectIdField project={project} />

          <AutoSaveForm
            name="platform"
            schema={projectSettingsSchema}
            initialValue={project.platform}
            mutationOptions={projectMutationOptions}
          >
            {field => (
              <field.Layout.Row
                label={t('Platform')}
                hintText={t('The primary platform for this project')}
              >
                <field.Select
                  value={field.state.value ?? null}
                  onChange={field.handleChange}
                  options={platformOptions}
                  filterOption={platformFilter}
                  isOptionDisabled={option =>
                    option.value === project.platform &&
                    !isPlatformAllowed({
                      isSelfHosted,
                      organization,
                      platform: option.value,
                    })
                  }
                  disabled={disabled}
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>
        </FieldGroup>

        <FieldGroup title={t('Email')}>
          <AutoSaveForm
            name="subjectPrefix"
            schema={projectSettingsSchema}
            initialValue={project.subjectPrefix ?? ''}
            mutationOptions={projectMutationOptions}
          >
            {field => (
              <field.Layout.Row
                label={t('Subject Prefix')}
                hintText={t('Choose a custom prefix for emails from this project')}
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={t('e.g. [my-org]')}
                  disabled={disabled}
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>
        </FieldGroup>

        <Override
          name="spend-visibility:spike-protection-project-settings"
          project={project}
        />

        <FieldGroup title={t('Event Settings')}>
          <AutoResolveForm project={project} disabled={disabled} />
          {organization.features.includes('auto-release-creation') && (
            <AutoSaveForm
              name="enableAutoReleaseCreation"
              schema={projectSettingsSchema}
              initialValue={project.enableAutoReleaseCreation}
              mutationOptions={projectMutationOptions}
              confirm={value =>
                value
                  ? undefined
                  : tct(
                      'Turning this off means Sentry will no longer create releases from ingested events. You will need to create releases manually, for example with the [link:Sentry CLI]. Are you sure you want to disable this?',
                      {
                        link: (
                          <ExternalLink href="https://docs.sentry.io/cli/releases/" />
                        ),
                      }
                    )
              }
            >
              {field => (
                <field.Layout.Row
                  label={t('Enable release auto-creation from telemetry')}
                  hintText={t(
                    'Automatically create releases when Sentry sees a new release in ingested events. When disabled, releases must be created manually (e.g. with the Sentry CLI).'
                  )}
                >
                  <field.Switch
                    checked={field.state.value}
                    onChange={field.handleChange}
                    disabled={disabled}
                  />
                </field.Layout.Row>
              )}
            </AutoSaveForm>
          )}
        </FieldGroup>

        <FieldGroup title={t('Membership')}>
          <AutoSaveForm
            name="debugFilesRole"
            schema={projectSettingsSchema}
            initialValue={project.debugFilesRole ?? null}
            mutationOptions={projectMutationOptions}
          >
            {field => (
              <field.Layout.Row
                label={t('Debug Files Access')}
                hintText={tct(
                  'Role required to download debug information files, proguard mappings and source maps. Overrides [organizationSettingsLink: organization settings].',
                  {
                    organizationSettingsLink: (
                      <Link
                        to={{
                          pathname: `/settings/${organization.slug}/`,
                          hash: 'debugFilesRole',
                        }}
                      />
                    ),
                  }
                )}
              >
                <field.Select
                  value={field.state.value ?? INHERIT_DEBUG_FILES_ROLE}
                  onChange={value =>
                    field.handleChange(value === INHERIT_DEBUG_FILES_ROLE ? null : value)
                  }
                  options={debugFilesRoleOptions}
                  disabled={disabled}
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>
        </FieldGroup>

        <FieldGroup title={t('Client Security')}>
          <Alert variant="info" system>
            <TextBlock noMargin>
              {tct(
                'Configure origin URLs which Sentry should accept events from. This is used for communication with clients like [link].',
                {
                  link: (
                    <ExternalLink href="https://github.com/getsentry/sentry-javascript">
                      sentry-javascript
                    </ExternalLink>
                  ),
                }
              )}{' '}
              {tct(
                'This will restrict requests based on the [code:Origin] and [code:Referer] headers.',
                {code: <code />}
              )}
            </TextBlock>
          </Alert>

          <AutoSaveForm
            name="allowedDomains"
            schema={projectSettingsSchema}
            initialValue={convertMultilineFieldValue(project.allowedDomains)}
            mutationOptions={{
              mutationFn: (data: {allowedDomains: string}) =>
                updateProject.mutateAsync({
                  allowedDomains: extractMultilineFields(data.allowedDomains),
                }),
            }}
          >
            {field => (
              <field.Layout.Row
                label={t('Allowed Domains')}
                hintText={allowedDomainsHelp}
              >
                <field.TextArea
                  value={field.state.value}
                  onChange={field.handleChange}
                  autosize
                  rows={1}
                  maxRows={10}
                  placeholder={t('https://example.com or example.com')}
                  disabled={disabled}
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>

          <AutoSaveForm
            name="scrapeJavaScript"
            schema={projectSettingsSchema}
            initialValue={orgScrapeJavaScript && Boolean(project.scrapeJavaScript)}
            mutationOptions={projectMutationOptions}
          >
            {field => (
              <field.Layout.Row
                label={t('Enable JavaScript source fetching')}
                hintText={t(
                  'Allow Sentry to scrape missing JavaScript source context when possible'
                )}
              >
                <field.Switch
                  checked={field.state.value}
                  onChange={field.handleChange}
                  disabled={orgScrapeJavaScript ? disabled : ORG_DISABLED_REASON}
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>

          <AutoSaveForm
            name="scmSourceContextEnabled"
            schema={projectSettingsSchema}
            initialValue={Boolean(project.scmSourceContextEnabled)}
            mutationOptions={projectMutationOptions}
            confirm={value =>
              value
                ? t(
                    'Enabling this will allow all members with access to this project to view source code from the connected SCM integration via code mappings. Are you sure you want to enable this?'
                  )
                : undefined
            }
          >
            {field => (
              <field.Layout.Row
                label={t('Enable SCM Source Context')}
                hintText={t(
                  "Fetch source code from your connected SCM integration (e.g. GitHub, GitLab) to display in stack traces. When enabled, any project member can view source code for files matched by this project's code mappings."
                )}
              >
                <field.Switch
                  checked={field.state.value}
                  onChange={field.handleChange}
                  disabled={disabled}
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>

          <SecurityTokenForm project={project} disabled={disabled} />

          <SecurityTokenHeaderForm project={project} disabled={disabled} />

          <AutoSaveForm
            name="verifySSL"
            schema={projectSettingsSchema}
            initialValue={Boolean(project.verifySSL)}
            mutationOptions={projectMutationOptions}
          >
            {field => (
              <field.Layout.Row
                label={t('Verify TLS/SSL')}
                hintText={t(
                  'Outbound requests will verify TLS (sometimes known as SSL) connections'
                )}
              >
                <field.Switch
                  checked={field.state.value}
                  onChange={field.handleChange}
                  disabled={disabled}
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>
        </FieldGroup>
      </FormSearch>

      <Panel>
        <PanelHeader>{t('Project Administration')}</PanelHeader>
        {renderRemoveProject()}
        {renderTransferProject()}
      </Panel>
    </div>
  );
}

export default function ProjectGeneralSettingsContainer() {
  const routes = useRoutes();
  const navigate = useNavigate();
  const organization = useOrganization();
  const location = useLocation();
  const {project} = useProjectSettingsOutlet();

  const handleChangeSlug = useCallback(
    (newSlug: string) => {
      navigate(
        recreateRoute('', {
          params: {
            orgId: organization.slug,
            projectId: newSlug,
          },
          routes,
          location,
        }),
        {replace: true}
      );
    },
    [navigate, organization.slug, routes, location]
  );

  if (!project?.id) {
    return <LoadingError message={t('Failed to load project.')} />;
  }

  return <ProjectGeneralSettings project={project} onChangeSlug={handleChangeSlug} />;
}
