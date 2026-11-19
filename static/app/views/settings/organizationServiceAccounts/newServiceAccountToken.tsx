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

const EXPIRATION_OPTIONS = [
  {value: '30', label: t('30 days')},
  {value: '60', label: t('60 days')},
  {value: '90', label: t('90 days')},
  {value: 'custom', label: t('Custom date')},
  {value: 'never', label: t('No expiration')},
];

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateInputValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const schema = z
  .object({
    name: z.string().trim().min(1, t('Name is required')),
    scopes: z.array(z.string()).min(1, t('Pick at least one permission')),
    expiration: z.string(),
    customDate: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.expiration !== 'custom') {
      return;
    }
    // Date inputs give YYYY-MM-DD, so tomorrow or later compares as greater.
    if (!values.customDate || values.customDate <= toDateInputValue(new Date())) {
      ctx.addIssue({
        code: 'custom',
        path: ['customDate'],
        message: t('Pick a date after today'),
      });
    }
  });

type FormValues = z.infer<typeof schema>;

function getExpiresAt({expiration, customDate}: FormValues): string | null {
  if (expiration === 'never') {
    return null;
  }
  if (expiration === 'custom') {
    // The token works through the end of the picked day, in the user's timezone.
    return new Date(`${customDate}T23:59:59`).toISOString();
  }
  return new Date(Date.now() + Number(expiration) * DAY_MS).toISOString();
}

const errorDetailSchema = z.union([
  z.string(),
  z.object({
    name: z.array(z.string()).optional(),
    scopes: z.array(z.string()).optional(),
    expiresAt: z.array(z.string()).optional(),
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
    mutationFn: (values: FormValues) =>
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
        data: {
          name: values.name.trim(),
          scopes: values.scopes,
          expiresAt: getExpiresAt(values),
        },
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

  const defaultValues: FormValues = {
    name: '',
    scopes: serviceAccount.scopes,
    expiration: '30',
    customDate: '',
  };

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
        const expiresAtError = detail?.expiresAt?.[0];
        if (nameError || scopesError || expiresAtError) {
          setFieldErrors(formApi, {
            ...(nameError ? {name: {message: nameError}} : {}),
            ...(scopesError ? {scopes: {message: scopesError}} : {}),
            ...(expiresAtError ? {expiration: {message: expiresAtError}} : {}),
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
        <form.AppField name="expiration">
          {field => (
            <field.Layout.Row
              label={t('Expiration')}
              hintText={
                field.state.value === 'never'
                  ? t(
                      'This token works until someone revokes it. Tokens that expire are safer.'
                    )
                  : t('The token stops working after this.')
              }
              required
            >
              <field.Select
                value={field.state.value}
                onChange={field.handleChange}
                options={EXPIRATION_OPTIONS}
              />
            </field.Layout.Row>
          )}
        </form.AppField>
        <form.Subscribe selector={state => state.values.expiration === 'custom'}>
          {isCustom =>
            isCustom && (
              <form.AppField name="customDate">
                {field => (
                  <field.Layout.Row label={t('Expiration date')} required>
                    <field.Input
                      type="date"
                      value={field.state.value}
                      onChange={field.handleChange}
                    />
                  </field.Layout.Row>
                )}
              </form.AppField>
            )
          }
        </form.Subscribe>
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
