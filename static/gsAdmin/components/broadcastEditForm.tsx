import {useMutation} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

import {
  ALL_PLANCHOICES,
  CATEGORYCHOICES,
  PLATFORMCHOICES,
  PRODUCTCHOICES,
  REGIONCHOICES,
  ROLECHOICES,
  TRIALCHOICES,
} from 'getsentry/utils/broadcasts';

type FormValue = string | string[] | boolean | null;
type FormValues = Record<string, FormValue>;
type EditField = {
  label: string;
  name: string;
  type: 'input' | 'date' | 'select' | 'multi' | 'switch';
  hintText?: string;
  maxLength?: number;
  options?: Array<{label: string; value: string}>;
  required?: boolean;
};

type Props = {
  broadcastId: string;
  data: Record<string, any>;
  onCancel: () => void;
  onSaved: () => void;
};

const toOptions = (choices: ReadonlyArray<readonly string[]>) =>
  choices.map(choice => ({value: choice[0]!, label: choice[1]!}));

const fields: EditField[] = [
  {name: 'title', label: 'Title', type: 'input', required: true, maxLength: 64},
  {name: 'message', label: 'Message', type: 'input', required: true, maxLength: 256},
  {name: 'link', label: 'Link', type: 'input', required: true},
  {
    name: 'organizations',
    label: 'Organization IDs',
    type: 'input',
    hintText:
      'Comma-separated list of organization IDs to restrict this broadcast to. If left empty, the broadcast will be shown to all users.',
  },
  {
    name: 'mediaUrl',
    label: 'Media URL',
    type: 'input',
    hintText: "Optional. Image or video shown in What's New.",
  },
  {
    name: 'category',
    label: 'Category',
    type: 'select',
    options: toOptions(CATEGORYCHOICES),
  },
  {name: 'dateExpires', label: 'Expires', type: 'date'},
  {name: 'isActive', label: 'Active', type: 'switch'},
  {name: 'roles', label: 'Roles', type: 'multi', options: toOptions(ROLECHOICES)},
  {name: 'plans', label: 'Plans', type: 'multi', options: toOptions(ALL_PLANCHOICES)},
  {
    name: 'trialStatus',
    label: 'Trial Status',
    type: 'select',
    options: toOptions(TRIALCHOICES),
  },
  {name: 'earlyAdopter', label: 'Early Adopter', type: 'switch'},
  {name: 'region', label: 'Region', type: 'select', options: toOptions(REGIONCHOICES)},
  {
    name: 'platform',
    label: 'Platform',
    type: 'multi',
    options: toOptions(PLATFORMCHOICES),
  },
  {name: 'product', label: 'Product', type: 'multi', options: toOptions(PRODUCTCHOICES)},
];

export function BroadcastEditForm({broadcastId, data, onCancel, onSaved}: Props) {
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetchMutation({
        url: getApiUrl('/broadcasts/$broadcastId/', {path: {broadcastId}}),
        method: 'PUT',
        data: payload,
      }),
    onSuccess: () => {
      addSuccessMessage('Broadcast updated.');
      onSaved();
    },
    onError: error => {
      const detail =
        error instanceof RequestError ? error.responseJSON?.detail : undefined;
      addErrorMessage(
        `Save failed: ${typeof detail === 'string' ? detail : 'Unknown error'}`
      );
    },
  });

  const defaultValues: FormValues = {
    title: data.title ?? '',
    message: data.message ?? '',
    link: data.link ?? '',
    organizations: data.organizations?.length ? data.organizations.join(', ') : '',
    mediaUrl: data.mediaUrl ?? '',
    category: data.category ?? null,
    dateExpires: data.dateExpires?.slice(0, 16) ?? '',
    isActive: Boolean(data.isActive),
    roles: data.roles ?? [],
    plans: data.plans ?? [],
    trialStatus: typeof data.trialStatus === 'string' ? data.trialStatus : null,
    earlyAdopter: Boolean(data.earlyAdopter),
    region: data.region ?? null,
    platform: data.platform ?? [],
    product: data.product ?? [],
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    onSubmit: ({value}) => {
      const errors: Record<string, {message: string}> = {};
      for (const field of fields) {
        if (field.required && !value[field.name]) {
          errors[field.name] = {message: 'This field is required'};
        }
      }
      if (Object.keys(errors).length) {
        setFieldErrors(form, errors);
        return;
      }
      const payload: Record<string, unknown> = {};
      for (const [key, fieldValue] of Object.entries(value)) {
        if (key === 'dateExpires') {
          payload.dateExpires = fieldValue || null;
        } else if (fieldValue !== '' && fieldValue !== null && fieldValue !== undefined) {
          payload[key] = fieldValue;
        }
      }
      if (typeof value.organizations === 'string') {
        payload.organizations = value.organizations
          .split(',')
          .map(s => Number(s.trim()))
          .filter(n => n > 0);
      }
      return mutation.mutateAsync(payload).catch(() => {});
    },
  });

  return (
    <form.AppForm form={form}>
      <Stack gap="lg">
        {data.upstreamId && !data.syncLocked && (
          <Alert variant="info">
            This broadcast was created from the changelog. Saving edits will lock it from
            future hourly syncs.
          </Alert>
        )}
        {data.upstreamId && data.syncLocked && (
          <Alert variant="warning">
            Changelog sync is locked for this broadcast. Use “Re-enable changelog sync” to
            let the hourly job refresh it again.
          </Alert>
        )}
        {fields.map(config => (
          <form.AppField key={config.name} name={config.name}>
            {field => {
              const currentValue = field.state.value;
              if (config.type === 'switch') {
                return (
                  <field.Layout.Row label={config.label}>
                    <field.Switch
                      checked={Boolean(currentValue)}
                      onChange={field.handleChange}
                    />
                  </field.Layout.Row>
                );
              }
              if (config.type === 'multi') {
                return (
                  <field.Layout.Stack label={config.label}>
                    <field.Select
                      multiple
                      value={Array.isArray(currentValue) ? currentValue : []}
                      onChange={field.handleChange}
                      options={config.options ?? []}
                    />
                  </field.Layout.Stack>
                );
              }
              if (config.type === 'select') {
                return (
                  <field.Layout.Stack label={config.label}>
                    <field.Select
                      clearable
                      value={typeof currentValue === 'string' ? currentValue : null}
                      onChange={field.handleChange}
                      options={config.options ?? []}
                    />
                  </field.Layout.Stack>
                );
              }
              return (
                <field.Layout.Stack
                  label={config.label}
                  hintText={config.hintText}
                  required={config.required}
                >
                  <field.Input
                    type={config.type === 'date' ? 'datetime-local' : 'text'}
                    value={typeof currentValue === 'string' ? currentValue : ''}
                    onChange={field.handleChange}
                    maxLength={config.maxLength}
                  />
                </field.Layout.Stack>
              );
            }}
          </form.AppField>
        ))}
        <Flex gap="sm" justify="end">
          <Button onClick={onCancel}>Cancel</Button>
          <form.SubmitButton>Save Changes</form.SubmitButton>
        </Flex>
      </Stack>
    </form.AppForm>
  );
}
