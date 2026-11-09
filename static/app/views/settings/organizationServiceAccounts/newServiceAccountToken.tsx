import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {toast} from '@sentry/scraps/toast';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {displayNewToken} from 'sentry/views/settings/components/newTokenHandler';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {getServiceAccountScopeOptions} from './scopes';
import {
  serviceAccountOptions,
  serviceAccountTokensOptions,
} from './serviceAccountDetails';
import type {NewServiceAccountToken, ServiceAccount} from './types';

const schema = z.object({
  name: z.string().trim().min(1, t('Name is required')),
  scopes: z.array(z.string()).min(1, t('Pick at least one permission')),
});

type FormValues = z.infer<typeof schema>;

const errorDetailSchema = z.union([
  z.string(),
  z.object({
    name: z.array(z.string()).optional(),
    scopes: z.array(z.string()).optional(),
  }),
]);

function getErrorDetail(error: RequestError) {
  const result = errorDetailSchema.safeParse(error.responseJSON?.detail);
  return result.success ? result.data : null;
}

function NewTokenForm({serviceAccount}: {serviceAccount: ServiceAccount}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const detailsPath = `/settings/${organization.slug}/service-accounts/${serviceAccount.id}/`;
  const handleGoBack = () => navigate(detailsPath);

  const mutation = useMutation({
    mutationFn: ({name, scopes}: FormValues) =>
      fetchMutation<NewServiceAccountToken>({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/service-accounts/$serviceAccountId/tokens/',
          {
            path: {
              organizationIdOrSlug: organization.slug,
              serviceAccountId: serviceAccount.id,
            },
          }
        ),
        method: 'POST',
        data: {name: name.trim(), scopes},
      }),
    onSuccess: token => {
      queryClient.invalidateQueries({
        queryKey: serviceAccountTokensOptions({
          orgSlug: organization.slug,
          serviceAccountId: serviceAccount.id,
        }).queryKey,
      });
      displayNewToken(token.token, handleGoBack);
    },
  });

  const defaultValues: FormValues = {name: '', scopes: serviceAccount.scopes};

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
        const scopesError = detail?.scopes?.[0];
        if (nameError || scopesError) {
          setFieldErrors(formApi, {
            ...(nameError ? {name: {message: nameError}} : {}),
            ...(scopesError ? {scopes: {message: scopesError}} : {}),
          });
        } else {
          toast.error(t('Failed to create the token.'));
        }
      }
    },
  });

  return (
    <form.AppForm form={form}>
      <form.FieldGroup title={t('Token')}>
        <form.AppField name="name">
          {field => (
            <field.Layout.Row
              label={t('Name')}
              hintText={t('A name to help you identify where this token is used.')}
              required
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t('e.g. github-actions')}
              />
            </field.Layout.Row>
          )}
        </form.AppField>
        <form.AppField name="scopes">
          {field => (
            <field.Layout.Row
              label={t('Permission scopes')}
              hintText={t('A token can only have scopes its service account has.')}
              required
            >
              <field.Select
                multiple
                clearable
                searchable
                value={field.state.value}
                onChange={field.handleChange}
                options={getServiceAccountScopeOptions(
                  serviceAccount.scopes,
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
          {t('Create Token')}
        </form.SubmitButton>
      </Flex>
    </form.AppForm>
  );
}

export default function OrganizationServiceAccountNewToken() {
  const organization = useOrganization();
  const {serviceAccountId} = useParams<{serviceAccountId: string}>();

  const {
    data: serviceAccount,
    isPending,
    isError,
    refetch,
  } = useQuery(serviceAccountOptions({orgSlug: organization.slug, serviceAccountId}));

  return (
    <SentryDocumentTitle title={t('Create Token')} orgSlug={organization.slug}>
      <SettingsPageHeader
        title={t('Create Token')}
        subtitle={t(
          'The token authenticates as the service account. You will see it once, right after you create it.'
        )}
      />
      {isError && (
        <LoadingError
          message={t('Failed to load the service account.')}
          onRetry={refetch}
        />
      )}
      {isPending && <LoadingIndicator />}
      {serviceAccount && <NewTokenForm serviceAccount={serviceAccount} />}
    </SentryDocumentTitle>
  );
}
