import {useCallback, useMemo} from 'react';
import {mutationOptions} from '@tanstack/react-query';
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
  useScrapsForm,
} from '@sentry/scraps/form';
import {Container, Flex} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {
  changeProjectSlug,
  removeProject,
  transferProject,
} from 'sentry/actionCreators/projects';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Confirm} from 'sentry/components/confirm';
import {createFilter} from 'sentry/components/forms/controls/reactSelectWrapper';
import {FieldGroup as LegacyFieldGroup} from 'sentry/components/forms/fieldGroup';
import Hook from 'sentry/components/hook';
import {Hovercard} from 'sentry/components/hovercard';
import {LoadingError} from 'sentry/components/loadingError';
import {removePageFiltersStorage} from 'sentry/components/pageFilters/persistence';
import {Panel} from 'sentry/components/panels/panel';
import {PanelAlert} from 'sentry/components/panels/panelAlert';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {consoles} from 'sentry/data/platformCategories';
import {allPlatforms as platforms} from 'sentry/data/platforms';
import {t, tct, tn} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {SelectValue} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey, Project} from 'sentry/types/project';
import {convertMultilineFieldValue, extractMultilineFields} from 'sentry/utils';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getDynamicText} from 'sentry/utils/getDynamicText';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {
  fetchMutation,
  setApiQueryData,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import {recreateRoute} from 'sentry/utils/recreateRoute';
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
  project: Project;
};

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

// --- Schemas ---

const slugSchema = z.object({
  slug: z.string().min(1, t('Slug is required')),
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

const platformSchema = z.object({platform: z.string()});
const subjectPrefixSchema = z.object({subjectPrefix: z.string()});
const allowedDomainsSchema = z.object({allowedDomains: z.string()});
const scrapeJavaScriptSchema = z.object({scrapeJavaScript: z.boolean()});
const verifySSLSchema = z.object({verifySSL: z.boolean()});
const debugFilesRoleSchema = z.object({debugFilesRole: z.string().nullable()});

// --- Resolve Age helpers ---

const getResolveAgeAllowedValues = () => {
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
};

const RESOLVE_AGE_ALLOWED_VALUES = getResolveAgeAllowedValues();

function formatResolveAge(val: number): string {
  if (val === 0) {
    return t('Disabled');
  }
  if (val > 23 && val % 24 === 0) {
    return tn('%s day', '%s days', val / 24);
  }
  return tn('%s hour', '%s hours', val);
}

const RESOLVE_AGE_OPTIONS = RESOLVE_AGE_ALLOWED_VALUES.map(val => ({
  value: val,
  label: formatResolveAge(val),
}));

// --- Platform options ---

const PLATFORM_OPTIONS = platforms.map(({id, name}) => ({
  value: id,
  label: (
    <Flex key={id} align="center" gap="md">
      <PlatformIcon platform={id} />
      {name}
    </Flex>
  ),
}));

const PLATFORM_FILTER = createFilter({
  stringify: option => {
    const matchedPlatform = platforms.find(({id}) => id === option.value);
    return `${matchedPlatform?.name} ${option.value}`;
  },
});

const ORG_DISABLED_REASON = t(
  "This option is enforced by your organization's settings and cannot be customized per-project."
);

export function ProjectGeneralSettings({project, onChangeSlug}: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const {isSelfHosted} = useLegacyStore(ConfigStore);
  const organization = useOrganization();
  const api = useApi({persistInFlight: true});

  const makeProjectSettingsQueryKey: ApiQueryKey = [
    getApiUrl(`/projects/$organizationIdOrSlug/$projectIdOrSlug/`, {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
    }),
  ];

  const endpoint = `/projects/${organization.slug}/${project.slug}/`;
  const hasWriteAccess = hasEveryAccess(['project:write'], {organization, project});

  // --- Shared mutation options ---

  const onMutationSuccess = (resp: Project) => {
    setApiQueryData(queryClient, makeProjectSettingsQueryKey, resp);
    ProjectsStore.onUpdateSuccess(resp);
  };

  const projectMutationOpts = mutationOptions({
    mutationFn: (data: Partial<Project>) =>
      fetchMutation<Project>({method: 'PUT', url: endpoint, data}),
    onSuccess: onMutationSuccess,
  });

  const platformMutationOpts = mutationOptions({
    mutationFn: (data: {platform: string}) =>
      fetchMutation<Project>({method: 'PUT', url: endpoint, data}),
    onSuccess: onMutationSuccess,
  });

  const slugMutationOpts = mutationOptions({
    mutationFn: (data: {slug: string}) =>
      fetchMutation<Project>({method: 'PUT', url: endpoint, data}),
    onSuccess: (resp: Project) => {
      setApiQueryData(queryClient, makeProjectSettingsQueryKey, resp);
      if (project.slug !== resp.slug) {
        changeProjectSlug(project.slug, resp.slug);
        onChangeSlug(resp.slug);
      }
      ProjectsStore.onUpdateSuccess(resp);
    },
  });

  const {mutateAsync: updateSlug} = useMutation(slugMutationOpts);
  const {mutateAsync: updateResolveAge} = useMutation(projectMutationOpts);
  const {mutateAsync: updateSecurityToken} = useMutation(projectMutationOpts);
  const {mutateAsync: updateSecurityTokenHeader} = useMutation(projectMutationOpts);

  // --- Slug form (explicit save) ---

  const slugForm = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {slug: project.slug},
    validators: {onDynamic: slugSchema},
    onSubmit: ({value}) =>
      updateSlug({slug: value.slug})
        .then(() => slugForm.reset())
        .catch(() => {}),
  });

  // --- Resolve Age form (explicit save) ---

  const resolveAgeForm = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {resolveAge: project.resolveAge ?? 0},
    validators: {onDynamic: resolveAgeSchema},
    onSubmit: ({value}) =>
      updateResolveAge({resolveAge: value.resolveAge} as Partial<Project>)
        .then(() => resolveAgeForm.reset())
        .catch(() => {}),
  });

  // --- Security Token form (explicit save) ---

  const securityTokenForm = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      securityToken: getDynamicText({
        value: project.securityToken ?? '',
        fixed: '__SECURITY_TOKEN__',
      }),
    },
    validators: {onDynamic: securityTokenSchema},
    onSubmit: ({value}) =>
      updateSecurityToken({securityToken: value.securityToken} as Partial<Project>)
        .then(() => securityTokenForm.reset())
        .catch(() => {}),
  });

  // --- Security Token Header form (explicit save) ---

  const securityTokenHeaderForm = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {securityTokenHeader: project.securityTokenHeader ?? ''},
    validators: {onDynamic: securityTokenHeaderSchema},
    onSubmit: ({value}) =>
      updateSecurityTokenHeader({
        securityTokenHeader: value.securityTokenHeader,
      } as Partial<Project>)
        .then(() => securityTokenHeaderForm.reset())
        .catch(() => {}),
  });

  // --- Platform options (filtered) ---

  const filteredPlatformOptions = useMemo(
    () =>
      PLATFORM_OPTIONS.filter(({value}) => {
        if (project.platform === value) return true;
        return isPlatformAllowed({isSelfHosted, organization, platform: value});
      }),
    [project.platform, isSelfHosted, organization]
  );

  const isPlatformOptionDisabled = useCallback(
    (option: SelectValue<PlatformKey>) =>
      option.value === project.platform &&
      !isPlatformAllowed({isSelfHosted, organization, platform: option.value}),
    [project.platform, isSelfHosted, organization]
  );

  // --- Debug Files Role options ---

  const debugFilesRoleOptions = useMemo(() => {
    const orgRoleName =
      organization.orgRoleList?.find(r => r.id === organization.debugFilesRole)?.name ||
      organization.debugFilesRole;

    return [
      {
        value: '',
        label: tct('Inherit organization setting ([organizationValue])', {
          organizationValue: orgRoleName,
        }),
      },
      ...(organization.orgRoleList?.map(r => ({
        value: r.id,
        label: r.name,
      })) ?? []),
    ];
  }, [organization.orgRoleList, organization.debugFilesRole]);

  // --- Remove Project ---

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

  // --- Transfer Project ---

  let transferEmail = '';

  const handleTransferProject = async () => {
    if (!project) {
      return;
    }
    if (transferEmail.length < 1) {
      return;
    }

    try {
      await transferProject(api, organization.slug, project, transferEmail);
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
      <LegacyFieldGroup
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
              <Button priority="danger">{t('Remove Project')}</Button>
            </div>
          </Confirm>
        )}
      </LegacyFieldGroup>
    );
  };

  const renderTransferProject = () => {
    const {isInternal} = project;
    const isOrgOwner = hasEveryAccess(['org:admin'], {
      organization,
    });

    return (
      <LegacyFieldGroup
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
                  <TransferEmailField
                    onChange={value => {
                      transferEmail = value;
                    }}
                    onSubmit={confirm}
                  />
                </Panel>
              </div>
            )}
          >
            <div>
              <Button priority="danger">{t('Transfer Project')}</Button>
            </div>
          </Confirm>
        )}
      </LegacyFieldGroup>
    );
  };

  // --- Allowed Domains mutation (needs data transform) ---

  const allowedDomainsMutationOpts = mutationOptions({
    mutationFn: (data: {allowedDomains: string}) =>
      fetchMutation<Project>({
        method: 'PUT',
        url: endpoint,
        data: {allowedDomains: extractMultilineFields(data.allowedDomains)},
      }),
    onSuccess: (resp: Project) => {
      setApiQueryData(queryClient, makeProjectSettingsQueryKey, resp);
      ProjectsStore.onUpdateSuccess(resp);
    },
  });

  // --- scrapeJavaScript mutation (needs org-level check) ---

  const scrapeJsMutationOpts = mutationOptions({
    mutationFn: (data: {scrapeJavaScript: boolean}) =>
      fetchMutation<Project>({
        method: 'PUT',
        url: endpoint,
        data: {scrapeJavaScript: organization.scrapeJavaScript && data.scrapeJavaScript},
      }),
    onSuccess: (resp: Project) => {
      setApiQueryData(queryClient, makeProjectSettingsQueryKey, resp);
      ProjectsStore.onUpdateSuccess(resp);
    },
  });

  // --- debugFilesRole mutation (null for inherit) ---

  const debugFilesRoleMutationOpts = mutationOptions({
    mutationFn: (data: {debugFilesRole: string | null}) =>
      fetchMutation<Project>({
        method: 'PUT',
        url: endpoint,
        data: {debugFilesRole: data.debugFilesRole || null},
      }),
    onSuccess: (resp: Project) => {
      setApiQueryData(queryClient, makeProjectSettingsQueryKey, resp);
      ProjectsStore.onUpdateSuccess(resp);
    },
  });

  return (
    <FormSearch route="/settings/:orgId/projects/:projectId/">
      <SentryDocumentTitle title={t('Project Settings')} projectSlug={project.slug} />
      <SettingsPageHeader title={t('Project Settings')} />
      <ProjectPermissionAlert project={project} />

      {/* Project Details */}
      <FieldGroup title={t('Project Details')}>
        {/* Slug — explicit save with warning */}
        <slugForm.AppForm form={slugForm}>
          <slugForm.AppField name="slug">
            {field => (
              <field.Layout.Row
                label={t('Slug')}
                hintText={t('A unique ID used to identify this project')}
                required
              >
                <field.Input
                  value={field.state.value}
                  onChange={value => field.handleChange(slugify(value))}
                  disabled={!hasWriteAccess}
                />
              </field.Layout.Row>
            )}
          </slugForm.AppField>
          <slugForm.Subscribe selector={state => state.values.slug !== project.slug}>
            {isDirty =>
              isDirty && (
                <Container paddingTop="lg">
                  <Alert variant="warning">
                    {t(
                      "Changing a project's slug can break your build scripts! Please proceed carefully."
                    )}
                  </Alert>
                  <Flex gap="sm" justify="end" paddingTop="lg">
                    <Button onClick={() => slugForm.reset()} disabled={!hasWriteAccess}>
                      {t('Cancel')}
                    </Button>
                    <slugForm.SubmitButton disabled={!hasWriteAccess}>
                      {t('Save')}
                    </slugForm.SubmitButton>
                  </Flex>
                </Container>
              )
            }
          </slugForm.Subscribe>
        </slugForm.AppForm>

        {/* Project ID — read-only display */}
        <LegacyFieldGroup
          label={t('Project ID')}
          help={t('The unique identifier for this project. It cannot be modified.')}
        >
          <div>{project.id}</div>
        </LegacyFieldGroup>

        {/* Platform */}
        <AutoSaveForm
          name="platform"
          schema={platformSchema}
          initialValue={project.platform ?? ''}
          mutationOptions={platformMutationOpts}
        >
          {field => (
            <field.Layout.Row
              label={t('Platform')}
              hintText={t('The primary platform for this project')}
            >
              <field.Select
                options={filteredPlatformOptions}
                value={field.state.value as PlatformKey}
                onChange={field.handleChange}
                disabled={!hasWriteAccess}
                filterOption={PLATFORM_FILTER}
                isOptionDisabled={isPlatformOptionDisabled}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>
      </FieldGroup>

      {/* Email */}
      <FieldGroup title={t('Email')}>
        <AutoSaveForm
          name="subjectPrefix"
          schema={subjectPrefixSchema}
          initialValue={project.subjectPrefix ?? ''}
          mutationOptions={projectMutationOpts}
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
                disabled={!hasWriteAccess}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>
      </FieldGroup>

      <Hook name="spend-visibility:spike-protection-project-settings" project={project} />

      {/* Event Settings */}
      <FieldGroup title={t('Event Settings')}>
        <resolveAgeForm.AppForm form={resolveAgeForm}>
          <resolveAgeForm.AppField name="resolveAge">
            {field => (
              <field.Layout.Row
                label={t('Auto Resolve')}
                hintText={t(
                  "Automatically resolve an issue if it hasn't been seen for this amount of time"
                )}
              >
                <field.Select
                  options={RESOLVE_AGE_OPTIONS}
                  value={field.state.value}
                  onChange={field.handleChange}
                  disabled={!hasWriteAccess}
                />
              </field.Layout.Row>
            )}
          </resolveAgeForm.AppField>
          <resolveAgeForm.Subscribe
            selector={state => state.values.resolveAge !== (project.resolveAge ?? 0)}
          >
            {isDirty =>
              isDirty && (
                <Container paddingTop="lg">
                  <Alert variant="warning">
                    {tct(
                      '[strong:Caution]: Enabling auto resolve will immediately resolve anything that has not been seen within this period of time. There is no undo!',
                      {strong: <strong />}
                    )}
                  </Alert>
                  <Flex gap="sm" justify="end" paddingTop="lg">
                    <Button
                      onClick={() => resolveAgeForm.reset()}
                      disabled={!hasWriteAccess}
                    >
                      {t('Cancel')}
                    </Button>
                    <resolveAgeForm.SubmitButton disabled={!hasWriteAccess}>
                      {t('Save')}
                    </resolveAgeForm.SubmitButton>
                  </Flex>
                </Container>
              )
            }
          </resolveAgeForm.Subscribe>
        </resolveAgeForm.AppForm>
      </FieldGroup>

      {/* Membership */}
      <FieldGroup title={t('Membership')}>
        <AutoSaveForm
          name="debugFilesRole"
          schema={debugFilesRoleSchema}
          initialValue={project.debugFilesRole ?? ''}
          mutationOptions={debugFilesRoleMutationOpts}
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
                options={debugFilesRoleOptions}
                value={field.state.value}
                onChange={field.handleChange}
                disabled={!hasWriteAccess}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>
      </FieldGroup>

      {/* Client Security */}
      <FieldGroup title={t('Client Security')}>
        <PanelAlert variant="info">
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
              {
                code: <code />,
              }
            )}
          </TextBlock>
        </PanelAlert>

        {/* Allowed Domains */}
        <AutoSaveForm
          name="allowedDomains"
          schema={allowedDomainsSchema}
          initialValue={convertMultilineFieldValue(project.allowedDomains ?? [])}
          mutationOptions={allowedDomainsMutationOpts}
        >
          {field => (
            <field.Layout.Row
              label={t('Allowed Domains')}
              hintText={tct('Separate multiple entries with a newline. [examples]', {
                examples: (
                  <Hovercard
                    body={
                      <CodeBlock hideCopyButton>
                        {`https://example.com\n*.example.com\n*:80\n*`}
                      </CodeBlock>
                    }
                  >
                    <Button priority="link" size="xs">
                      {t('View Examples')}
                    </Button>
                  </Hovercard>
                ),
              })}
            >
              <field.TextArea
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t('https://example.com or example.com')}
                rows={1}
                autosize
                maxRows={10}
                disabled={!hasWriteAccess}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>

        {/* Scrape JavaScript */}
        <AutoSaveForm
          name="scrapeJavaScript"
          schema={scrapeJavaScriptSchema}
          initialValue={!!(organization.scrapeJavaScript && project.scrapeJavaScript)}
          mutationOptions={scrapeJsMutationOpts}
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
                disabled={
                  organization.scrapeJavaScript ? !hasWriteAccess : ORG_DISABLED_REASON
                }
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>

        {/* Security Token — explicit save */}
        <securityTokenForm.AppForm form={securityTokenForm}>
          <securityTokenForm.AppField name="securityToken">
            {field => (
              <field.Layout.Row
                label={t('Security Token')}
                hintText={t(
                  'Outbound requests matching Allowed Domains will have the header "{token_header}: {token}" appended'
                )}
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  disabled={!hasWriteAccess}
                />
              </field.Layout.Row>
            )}
          </securityTokenForm.AppField>
          <securityTokenForm.Subscribe
            selector={state =>
              state.values.securityToken !==
              getDynamicText({
                value: project.securityToken ?? '',
                fixed: '__SECURITY_TOKEN__',
              })
            }
          >
            {isDirty =>
              isDirty && (
                <Container paddingTop="lg">
                  <Alert variant="info">
                    {t('Ensure you update usages of your security token.')}
                  </Alert>
                  <Flex gap="sm" justify="end" paddingTop="lg">
                    <Button
                      onClick={() => securityTokenForm.reset()}
                      disabled={!hasWriteAccess}
                    >
                      {t('Cancel')}
                    </Button>
                    <securityTokenForm.SubmitButton disabled={!hasWriteAccess}>
                      {t('Save')}
                    </securityTokenForm.SubmitButton>
                  </Flex>
                </Container>
              )
            }
          </securityTokenForm.Subscribe>
        </securityTokenForm.AppForm>

        {/* Security Token Header — explicit save */}
        <securityTokenHeaderForm.AppForm form={securityTokenHeaderForm}>
          <securityTokenHeaderForm.AppField name="securityTokenHeader">
            {field => (
              <field.Layout.Row
                label={t('Security Token Header')}
                hintText={t(
                  'Outbound requests matching Allowed Domains will have the header "{token_header}: {token}" appended'
                )}
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={t('X-Sentry-Token')}
                  disabled={!hasWriteAccess}
                />
              </field.Layout.Row>
            )}
          </securityTokenHeaderForm.AppField>
          <securityTokenHeaderForm.Subscribe
            selector={state =>
              state.values.securityTokenHeader !== (project.securityTokenHeader ?? '')
            }
          >
            {isDirty =>
              isDirty && (
                <Container paddingTop="lg">
                  <Alert variant="info">
                    {t('Ensure you update usages of the security token header.')}
                  </Alert>
                  <Flex gap="sm" justify="end" paddingTop="lg">
                    <Button
                      onClick={() => securityTokenHeaderForm.reset()}
                      disabled={!hasWriteAccess}
                    >
                      {t('Cancel')}
                    </Button>
                    <securityTokenHeaderForm.SubmitButton disabled={!hasWriteAccess}>
                      {t('Save')}
                    </securityTokenHeaderForm.SubmitButton>
                  </Flex>
                </Container>
              )
            }
          </securityTokenHeaderForm.Subscribe>
        </securityTokenHeaderForm.AppForm>

        {/* Verify SSL */}
        <AutoSaveForm
          name="verifySSL"
          schema={verifySSLSchema}
          initialValue={project.verifySSL ?? false}
          mutationOptions={projectMutationOpts}
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
                disabled={!hasWriteAccess}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>
      </FieldGroup>

      {/* Project Administration */}
      <Panel>
        <PanelHeader>{t('Project Administration')}</PanelHeader>
        {renderRemoveProject()}
        {renderTransferProject()}
      </Panel>
    </FormSearch>
  );
}

// --- Transfer Email Field ---

function TransferEmailField({
  onChange,
  onSubmit,
}: {
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const transferSchema = z.object({
    email: z.string().min(1),
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {email: ''},
    validators: {onDynamic: transferSchema},
    onSubmit: ({value}) => {
      onChange(value.email);
      onSubmit();
      return Promise.resolve();
    },
  });

  return (
    <form.AppForm form={form}>
      <form.AppField name="email">
        {field => (
          <field.Layout.Row
            label={t('Organization Owner')}
            hintText={t(
              'A request will be emailed to this address, asking the organization owner to accept the project transfer.'
            )}
            required
          >
            <field.Input
              value={field.state.value}
              onChange={value => {
                field.handleChange(value);
                onChange(value);
              }}
              placeholder="admin@example.com"
            />
          </field.Layout.Row>
        )}
      </form.AppField>
    </form.AppForm>
  );
}

// --- Container Component ---

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
