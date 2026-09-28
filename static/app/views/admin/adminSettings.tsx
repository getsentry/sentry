import {useQuery, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm, FieldGroup, FormErrorContextProvider} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

import {getOption} from './options';

type Field = ReturnType<typeof getOption>;

type FieldDef = {
  field: Partial<Field>;
  value?: boolean | number | string;
};

const optionsQueryOptions = apiOptions.as<Record<string, FieldDef>>()(
  '/internal/options/',
  {staleTime: 0}
);

const disabledReasons: Record<string, string> = {
  diskPriority:
    'This setting is defined in config.yml and may not be changed via the web UI.',
  smtpDisabled: 'SMTP mail has been disabled, so this option is unavailable',
};

function getOptionSaveErrorMessage(error: Error): string {
  if (error instanceof RequestError) {
    if (error.status === 403) {
      return t('You need active superuser access to change this setting.');
    }

    if (error.status === 400) {
      switch (error.responseJSON?.error) {
        case 'immutable_option':
          return t('This setting is managed by your Sentry configuration.');
        case 'invalid_type':
          return t('This value is not valid for this setting.');
        case 'unknown_option':
          return t('This setting is no longer available. Reload the page.');
        default:
          break;
      }
    }
  }

  return t('Could not save this setting. Try again.');
}

const mapOptionSaveError = (error: Error) => ({
  message: getOptionSaveErrorMessage(error),
});

function useAdminOption(name: string, option: FieldDef) {
  const queryClient = useQueryClient();
  const definition = {...getOption(name), ...option.field};
  const initialValue =
    option.value === undefined ? (definition.defaultValue?.() ?? '') : option.value;
  const disabled = definition.disabled
    ? (disabledReasons[definition.disabledReason ?? ''] ?? true)
    : false;
  const required = definition.required && !definition.allowEmpty;

  return {
    definition,
    initialValue,
    disabled,
    required,
    save: (value: boolean | string) =>
      fetchMutation({
        url: getApiUrl('/internal/options/'),
        method: 'PUT',
        data: {[name]: value},
      }),
    refresh: () =>
      queryClient.invalidateQueries({queryKey: optionsQueryOptions.queryKey}),
  };
}

const rootUrlSchema = z
  .string()
  .trim()
  .pipe(z.url({protocol: /^https?$/, error: t('Enter a valid HTTP or HTTPS URL')}));

function getEmailSchema(required: boolean | undefined) {
  const email = z.email(t('Enter a valid email address'));
  return required ? email : email.or(z.literal(''));
}

function isEmailOption(name: string) {
  return (
    name === 'system.admin-email' ||
    name === 'system.support-email' ||
    name === 'system.security-email'
  );
}

function getTextOptionSchema(name: string, required: boolean | undefined) {
  if (name === 'system.url-prefix') {
    return rootUrlSchema;
  }
  if (isEmailOption(name)) {
    return getEmailSchema(required);
  }
  return z.string();
}

type OptionFieldProps = {name: string; option: FieldDef};

function BooleanOptionField({name, option}: OptionFieldProps) {
  const {definition, initialValue, disabled, required, save, refresh} = useAdminOption(
    name,
    option
  );

  return (
    <AutoSaveForm
      name="value"
      schema={z.object({value: z.boolean()})}
      initialValue={Boolean(initialValue)}
      mutationOptions={{
        mutationFn: data => save(data.value),
        onSuccess: refresh,
      }}
    >
      {field => (
        <field.Layout.Row
          label={definition.label}
          hintText={definition.help}
          required={required}
        >
          <field.Switch
            checked={field.state.value}
            onChange={field.handleChange}
            disabled={disabled}
          />
        </field.Layout.Row>
      )}
    </AutoSaveForm>
  );
}

function RadioOptionField({name, option}: OptionFieldProps) {
  const {definition, initialValue, disabled, required, save, refresh} = useAdminOption(
    name,
    option
  );

  return (
    <AutoSaveForm
      name="value"
      schema={z.object({value: z.string()})}
      initialValue={String(initialValue)}
      mutationOptions={{
        mutationFn: data => save(data.value),
        onSuccess: refresh,
      }}
    >
      {field => (
        <field.Layout.Stack
          label={definition.label}
          hintText={definition.help}
          required={required}
        >
          <field.Radio.Group
            value={field.state.value}
            onChange={field.handleChange}
            disabled={disabled}
          >
            {definition.choices?.map(([value, label]) => (
              <field.Radio.Item key={value} value={value}>
                {label}
              </field.Radio.Item>
            ))}
          </field.Radio.Group>
        </field.Layout.Stack>
      )}
    </AutoSaveForm>
  );
}

function TextOptionField({name, option}: OptionFieldProps) {
  const {definition, initialValue, disabled, required, save, refresh} = useAdminOption(
    name,
    option
  );

  return (
    <AutoSaveForm
      name="value"
      schema={z.object({value: getTextOptionSchema(name, required)})}
      initialValue={String(initialValue)}
      mutationOptions={{
        mutationFn: data => save(data.value),
        onSuccess: refresh,
      }}
    >
      {field => (
        <field.Layout.Row
          label={definition.label}
          hintText={definition.help}
          required={required}
        >
          <field.Input
            value={field.state.value}
            onChange={field.handleChange}
            disabled={disabled}
            placeholder={definition.placeholder}
          />
        </field.Layout.Row>
      )}
    </AutoSaveForm>
  );
}

export default function AdminSettings() {
  const {data, isPending, isError} = useQuery(optionsQueryOptions);

  if (isError) {
    return <LoadingError />;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  const option = (name: string): FieldDef => data[name] ?? {field: {}};

  return (
    <FormErrorContextProvider value={mapOptionSaveError}>
      <Stack gap="xl">
        <Heading as="h3" size="lg">
          {t('Settings')}
        </Heading>

        <FieldGroup title={t('General')}>
          <TextOptionField
            name="system.url-prefix"
            option={option('system.url-prefix')}
          />
          <TextOptionField
            name="system.admin-email"
            option={option('system.admin-email')}
          />
          <TextOptionField
            name="system.support-email"
            option={option('system.support-email')}
          />
          <TextOptionField
            name="system.security-email"
            option={option('system.security-email')}
          />
        </FieldGroup>

        <FieldGroup title={t('Security & Abuse')}>
          <BooleanOptionField
            name="auth.allow-registration"
            option={option('auth.allow-registration')}
          />
          <TextOptionField
            name="auth.ip-rate-limit"
            option={option('auth.ip-rate-limit')}
          />
          <TextOptionField
            name="auth.user-rate-limit"
            option={option('auth.user-rate-limit')}
          />
          <TextOptionField
            name="api.rate-limit.org-create"
            option={option('api.rate-limit.org-create')}
          />
        </FieldGroup>

        <FieldGroup title={t('Beacon')}>
          <RadioOptionField name="beacon.anonymous" option={option('beacon.anonymous')} />
        </FieldGroup>
      </Stack>
    </FormErrorContextProvider>
  );
}
