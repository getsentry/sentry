import {useQuery, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {BooleanField} from 'sentry/components/forms/fields/booleanField';
import {RadioField} from 'sentry/components/forms/fields/radioField';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

import {getOption} from './options';

type Field = ReturnType<typeof getOption>;

type FieldDef = {
  field: Field;
  value: boolean | number | string | undefined;
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

function AdminOptionField({name, option}: {name: string; option: FieldDef}) {
  const queryClient = useQueryClient();
  const definition = {...getOption(name), ...option.field};
  const rawInitialValue =
    option.value === undefined || option.value === ''
      ? (definition.defaultValue?.() ?? '')
      : option.value;
  const kind =
    definition.component === BooleanField
      ? 'boolean'
      : definition.component === RadioField
        ? 'radio'
        : 'text';
  const initialValue =
    kind === 'boolean' ? Boolean(rawInitialValue) : String(rawInitialValue);
  const disabled = definition.disabled
    ? (disabledReasons[definition.disabledReason ?? ''] ?? true)
    : false;
  const required = definition.required && !definition.allowEmpty;
  const stringSchema = required
    ? z.string().refine(value => value.trim().length > 0, t('This field is required'))
    : z.string();
  return (
    <AutoSaveForm
      name="value"
      schema={z.object({value: z.union([z.boolean(), stringSchema])})}
      initialValue={initialValue}
      mutationOptions={{
        mutationFn: data =>
          fetchMutation<void>({
            url: getApiUrl('/internal/options/'),
            method: 'PUT',
            data: {[name]: data.value},
          }),
        onSuccess: () =>
          queryClient.invalidateQueries({queryKey: optionsQueryOptions.queryKey}),
      }}
    >
      {field => {
        if (kind === 'boolean') {
          return (
            <field.Layout.Row
              label={definition.label}
              hintText={definition.help}
              required={required}
            >
              <field.Switch
                checked={field.state.value === true}
                onChange={field.handleChange}
                disabled={disabled}
              />
            </field.Layout.Row>
          );
        }

        if (kind === 'radio') {
          return (
            <field.Layout.Stack
              label={definition.label}
              hintText={definition.help}
              required={required}
            >
              <field.Radio.Group
                value={typeof field.state.value === 'string' ? field.state.value : ''}
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
          );
        }

        return (
          <field.Layout.Row
            label={definition.label}
            hintText={definition.help}
            required={required}
          >
            <field.Input
              value={typeof field.state.value === 'string' ? field.state.value : ''}
              onChange={field.handleChange}
              disabled={disabled}
              placeholder={definition.placeholder}
            />
          </field.Layout.Row>
        );
      }}
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

  const groups = [
    {
      title: t('General'),
      options: [
        'system.url-prefix',
        'system.admin-email',
        'system.support-email',
        'system.security-email',
      ],
    },
    {
      title: t('Security & Abuse'),
      options: [
        'auth.allow-registration',
        'auth.ip-rate-limit',
        'auth.user-rate-limit',
        'api.rate-limit.org-create',
      ],
    },
    {title: t('Beacon'), options: ['beacon.anonymous']},
  ];

  return (
    <Stack gap="xl">
      <Heading as="h3" size="lg">
        {t('Settings')}
      </Heading>

      {groups.map(group => (
        <FieldGroup key={group.title} title={group.title}>
          {group.options.map(name => (
            <AdminOptionField
              key={name}
              name={name}
              option={data[name] ?? ({field: {}, value: undefined} as FieldDef)}
            />
          ))}
        </FieldGroup>
      ))}
    </Stack>
  );
}
