import {Fragment, useEffect} from 'react';
import {mutationOptions, useQuery, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {BreadcrumbTitle} from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle';

import {getOption} from './options';

type FieldDef = {
  field: Partial<ReturnType<typeof getOption>>;
  value?: boolean | number | string;
};

const optionsQueryOptions = apiOptions.as<Record<string, FieldDef>>()(
  '/internal/options/',
  {staleTime: 0}
);

const disabledReasons: Record<string, string> = {
  diskPriority: t(
    'This setting is defined in config.yml and may not be changed via the web UI.'
  ),
  smtpDisabled: t('SMTP mail has been disabled, so this option is unavailable'),
};

function useAdminOption(name: string, option: FieldDef) {
  const queryClient = useQueryClient();
  const fieldName = name.replaceAll('.', '_');
  const definition = {...getOption(name), ...option.field};
  const initialValue =
    option.value === undefined ? (definition.defaultValue?.() ?? '') : option.value;
  const disabled = definition.disabled
    ? (disabledReasons[definition.disabledReason ?? ''] ?? true)
    : false;
  const required = definition.required && !definition.allowEmpty;

  return {
    definition,
    fieldName,
    initialValue,
    disabled,
    required,
    adminMutationOptions: mutationOptions({
      mutationFn: (data: Record<string, boolean | string>) =>
        fetchMutation({
          url: getApiUrl('/internal/options/'),
          method: 'PUT',
          data: {[name]: data[fieldName]},
        }),
      onSuccess: (_response, data) => {
        queryClient.setQueryData(optionsQueryOptions.queryKey, previous => {
          const value = data[fieldName];
          if (!previous || value === undefined) {
            return previous;
          }
          return {
            ...previous,
            json: {
              ...previous.json,
              [name]: {...(previous.json[name] ?? {field: {}}), value},
            },
          };
        });
      },
    }),
  };
}

const rootUrlSchema = z.url({
  protocol: /^https?$/,
  error: t('Enter a valid HTTP or HTTPS URL'),
});

const emailSchema = z.email(t('Enter a valid email address'));

function getTextOptionSchema(name: string, required: boolean | undefined) {
  if (name === 'system.url-prefix') {
    return rootUrlSchema;
  }
  if (
    name === 'system.admin-email' ||
    name === 'system.support-email' ||
    name === 'system.security-email'
  ) {
    return required ? emailSchema : emailSchema.or(z.literal(''));
  }
  return z.string();
}

type OptionFieldProps = {name: string; option: FieldDef};

function BooleanOptionField({name, option}: OptionFieldProps) {
  const {definition, fieldName, initialValue, disabled, required, adminMutationOptions} =
    useAdminOption(name, option);

  return (
    <AutoSaveForm
      name={fieldName}
      schema={z.object({[fieldName]: z.boolean()})}
      initialValue={Boolean(initialValue)}
      mutationOptions={adminMutationOptions}
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
  const {definition, fieldName, initialValue, disabled, required, adminMutationOptions} =
    useAdminOption(name, option);

  return (
    <AutoSaveForm
      name={fieldName}
      schema={z.object({[fieldName]: z.string()})}
      initialValue={String(initialValue)}
      mutationOptions={adminMutationOptions}
    >
      {field => (
        <field.Layout.Row
          label={definition.label}
          hintText={definition.help}
          required={required}
        >
          <field.Radio.Group
            value={field.state.value}
            onChange={field.handleChange}
            disabled={disabled}
          >
            <Stack gap="sm">
              {definition.choices?.map(([value, label]) => (
                <field.Radio.Item key={value} value={value}>
                  {label}
                </field.Radio.Item>
              ))}
            </Stack>
          </field.Radio.Group>
        </field.Layout.Row>
      )}
    </AutoSaveForm>
  );
}

function TextOptionField({name, option}: OptionFieldProps) {
  const {definition, fieldName, initialValue, disabled, required, adminMutationOptions} =
    useAdminOption(name, option);

  return (
    <AutoSaveForm
      name={fieldName}
      schema={z.object({[fieldName]: getTextOptionSchema(name, required)})}
      initialValue={String(initialValue)}
      mutationOptions={adminMutationOptions}
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
  return (
    <Fragment>
      <BreadcrumbTitle title={t('Settings')} />
      <AdminSettingsContent />
    </Fragment>
  );
}

function AdminSettingsContent() {
  const {data, isPending, isError} = useQuery(optionsQueryOptions);
  const location = useLocation();

  useEffect(() => {
    if (isPending || !location.hash) {
      return;
    }
    let name: string;
    try {
      name = decodeURIComponent(location.hash.slice(1));
    } catch {
      return;
    }
    const row = document.getElementById(name.replaceAll('.', '_'));
    if (!row) {
      return;
    }
    row.scrollIntoView({block: 'center', behavior: 'smooth'});
    row.querySelector('input')?.focus({focusVisible: true});
    row.dataset.highlight = '';
    const clearHighlight = () => delete row.dataset.highlight;
    row.addEventListener('animationend', clearHighlight, {once: true});
    return () => row.removeEventListener('animationend', clearHighlight);
  }, [isPending, location.hash]);

  if (isError) {
    return <LoadingError />;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  return (
    <Stack gap="xl">
      <FieldGroup title={t('General')}>
        <TextOptionField
          name="system.url-prefix"
          option={data['system.url-prefix'] ?? {field: {}}}
        />
        <TextOptionField
          name="system.admin-email"
          option={data['system.admin-email'] ?? {field: {}}}
        />
        <TextOptionField
          name="system.support-email"
          option={data['system.support-email'] ?? {field: {}}}
        />
        <TextOptionField
          name="system.security-email"
          option={data['system.security-email'] ?? {field: {}}}
        />
      </FieldGroup>

      <FieldGroup title={t('Security & Abuse')}>
        <BooleanOptionField
          name="auth.allow-registration"
          option={data['auth.allow-registration'] ?? {field: {}}}
        />
        <TextOptionField
          name="auth.ip-rate-limit"
          option={data['auth.ip-rate-limit'] ?? {field: {}}}
        />
        <TextOptionField
          name="auth.user-rate-limit"
          option={data['auth.user-rate-limit'] ?? {field: {}}}
        />
        <TextOptionField
          name="api.rate-limit.org-create"
          option={data['api.rate-limit.org-create'] ?? {field: {}}}
        />
      </FieldGroup>

      <FieldGroup title={t('Beacon')}>
        <RadioOptionField
          name="beacon.anonymous"
          option={data['beacon.anonymous'] ?? {field: {}}}
        />
      </FieldGroup>
    </Stack>
  );
}
