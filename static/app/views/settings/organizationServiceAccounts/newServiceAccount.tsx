import {useMutation, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {toast} from '@sentry/scraps/toast';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {serviceAccountsOptions} from './index';
import {
  getDefaultServiceAccountScopes,
  getGrantableServiceAccountScopes,
  getServiceAccountScopeOptions,
} from './scopes';
import type {ServiceAccount} from './types';

// Matches MAX_NAME_LENGTH in sentry/service_accounts/models.py.
const MAX_NAME_LENGTH = 64;

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, t('Name is required'))
    .max(MAX_NAME_LENGTH, t('Name must be %s characters or fewer', MAX_NAME_LENGTH)),
  projectAccess: z.enum(['all', 'specific']),
  projectIds: z.array(z.string()),
  scopes: z.array(z.string()).min(1, t('Select at least one permission scope.')),
});

type FormValues = z.infer<typeof schema>;

const errorDetailSchema = z.union([
  z.string(),
  z.object({
    name: z.array(z.string()).optional(),
    projectIds: z.array(z.string()).optional(),
    scopes: z.array(z.string()).optional(),
  }),
]);

function getErrorDetail(error: RequestError) {
  const result = errorDetailSchema.safeParse(error.responseJSON?.detail);
  return result.success ? result.data : null;
}

export default function OrganizationServiceAccountsNew() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {projects} = useProjects();
  const grantableScopes = getGrantableServiceAccountScopes(organization);
  const defaultValues: FormValues = {
    name: '',
    projectAccess: 'specific',
    projectIds: [],
    scopes: getDefaultServiceAccountScopes(organization),
  };

  const handleGoBack = () => navigate(`/settings/${organization.slug}/service-accounts/`);

  const mutation = useMutation<ServiceAccount, RequestError, FormValues>({
    mutationFn: ({name, projectAccess, projectIds, scopes}) =>
      fetchMutation<ServiceAccount>({
        url: getApiUrl('/organizations/$organizationIdOrSlug/service-accounts/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        method: 'POST',
        data: {
          name: name.trim(),
          scopes,
          allProjects: projectAccess === 'all',
          projectIds: projectAccess === 'all' ? [] : projectIds.map(Number),
        },
      }),
    onSuccess: serviceAccount => {
      toast.success(t('Created service account %s.', serviceAccount.name));
      queryClient.invalidateQueries({
        queryKey: serviceAccountsOptions({orgSlug: organization.slug}).queryKey,
      });
      handleGoBack();
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: async ({value, formApi}) => {
      try {
        await mutation.mutateAsync(value);
      } catch (error) {
        if (!(error instanceof RequestError)) {
          throw error;
        }
        const detail = getErrorDetail(error);
        if (typeof detail === 'string') {
          toast.error(detail);
          return;
        }
        const nameError = detail?.name?.[0];
        const projectIdsError = detail?.projectIds?.[0];
        const scopesError = detail?.scopes?.[0];
        if (nameError || projectIdsError || scopesError) {
          setFieldErrors(formApi, {
            ...(nameError ? {name: {message: nameError}} : {}),
            ...(projectIdsError ? {projectIds: {message: projectIdsError}} : {}),
            ...(scopesError ? {scopes: {message: scopesError}} : {}),
          });
        } else {
          toast.error(t('Failed to create the service account.'));
        }
      }
    },
  });

  const projectOptions = projects
    .filter(project => project.isMember || project.hasAccess)
    .map(project => ({value: project.id, label: project.slug}));

  return (
    <SentryDocumentTitle title={t('Create Service Account')} orgSlug={organization.slug}>
      <SettingsPageHeader
        title={t('Create Service Account')}
        subtitle={t(
          'A service account acts as itself, never as the person who created it. You can only give it permissions and projects you have yourself.'
        )}
      />
      <form.AppForm form={form}>
        <form.FieldGroup title={t('Details')}>
          <form.AppField name="name">
            {field => (
              <field.Layout.Row
                label={t('Name')}
                hintText={t(
                  'Shown in audit logs and activity wherever this account acts.'
                )}
                required
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={t('e.g. github-actions-deploy')}
                />
              </field.Layout.Row>
            )}
          </form.AppField>
        </form.FieldGroup>

        <form.FieldGroup title={t('Project Access')}>
          <form.AppField name="projectAccess">
            {field => (
              <field.RadioGroup value={field.state.value} onChange={field.handleChange}>
                {({Item}) => (
                  <field.Layout.Row
                    label={t('Access')}
                    hintText={t(
                      'Service accounts ignore open membership. They reach every project, or only the ones you pick.'
                    )}
                  >
                    <Stack gap="md">
                      <Item
                        value="specific"
                        description={t('Only the projects you choose below.')}
                      >
                        {t('Specific projects')}
                      </Item>
                      <Item
                        value="all"
                        description={t(
                          'Every active project, including ones created later. Needs the Manager or Owner role.'
                        )}
                      >
                        {t('All projects')}
                      </Item>
                    </Stack>
                  </field.Layout.Row>
                )}
              </field.RadioGroup>
            )}
          </form.AppField>
          <form.Subscribe selector={state => state.values.projectAccess === 'specific'}>
            {showProjects =>
              showProjects ? (
                <form.AppField name="projectIds">
                  {field => (
                    <field.Layout.Row
                      label={t('Projects')}
                      hintText={t('Only projects you can access are listed.')}
                    >
                      <field.Select
                        multiple
                        clearable
                        value={field.state.value}
                        onChange={field.handleChange}
                        options={projectOptions}
                      />
                    </field.Layout.Row>
                  )}
                </form.AppField>
              ) : null
            }
          </form.Subscribe>
        </form.FieldGroup>

        <form.FieldGroup title={t('Permissions')}>
          <form.AppField name="scopes">
            {field => (
              <field.Layout.Row
                label={t('Permission scopes')}
                hintText={t(
                  'Starts with read access. Add write permissions only for actions you want the service account to perform.'
                )}
                required
              >
                <field.Select
                  multiple
                  clearable
                  searchable
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={getServiceAccountScopeOptions(
                    grantableScopes,
                    field.state.value
                  )}
                />
              </field.Layout.Row>
            )}
          </form.AppField>
        </form.FieldGroup>

        <Flex justify="end" gap="md" padding="md">
          <Button onClick={handleGoBack}>{t('Cancel')}</Button>
          <form.SubmitButton disabled={mutation.isSuccess}>
            {t('Create Service Account')}
          </form.SubmitButton>
        </Flex>
      </form.AppForm>
    </SentryDocumentTitle>
  );
}
