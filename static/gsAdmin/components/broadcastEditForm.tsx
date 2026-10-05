import {useMutation, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

import type {BroadcastDetailsData} from 'admin/types';
import {
  ALL_PLANCHOICES,
  CATEGORYCHOICES,
  platformOptions,
  PRODUCTCHOICES,
  REGIONCHOICES,
  ROLECHOICES,
  TRIALCHOICES,
} from 'getsentry/utils/broadcasts';

type Props = {
  broadcastId: string;
  data: BroadcastDetailsData;
  onCancel: () => void;
  onSaved: () => void;
};

const formSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(64, 'Title must be 64 characters or fewer'),
  message: z
    .string()
    .trim()
    .min(1, 'Message is required')
    .max(256, 'Message must be 256 characters or fewer'),
  link: z.url({protocol: /^https?$/, error: 'Enter a valid http or https URL'}),
  organizations: z.string(),
  mediaUrl: z.union([
    z.literal(''),
    z.url({protocol: /^https?$/, error: 'Enter a valid http or https URL'}),
  ]),
  category: z.string().nullable(),
  dateExpires: z.string(),
  isActive: z.boolean(),
  roles: z.array(z.string()),
  plans: z.array(z.string()),
  trialStatus: z.array(z.string()),
  earlyAdopter: z.boolean(),
  region: z.string().nullable(),
  platform: z.array(z.string()),
  product: z.array(z.string()),
});

export function BroadcastEditForm({broadcastId, data, onCancel, onSaved}: Props) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetchMutation({
        url: getApiUrl('/broadcasts/$broadcastId/', {path: {broadcastId}}),
        method: 'PUT',
        data: payload,
      }),
    onSuccess: () => {
      addSuccessMessage('Broadcast updated.');
      queryClient.invalidateQueries({
        queryKey: [getApiUrl('/broadcasts/$broadcastId/', {path: {broadcastId}})],
      });
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

  const defaultValues: z.input<typeof formSchema> = {
    title: data.title ?? '',
    message: data.message ?? '',
    link: data.link ?? '',
    organizations: data.organizations?.join(', ') ?? '',
    mediaUrl: data.mediaUrl ?? '',
    category: data.category ?? null,
    dateExpires: data.dateExpires?.slice(0, 16) ?? '',
    isActive: Boolean(data.isActive),
    roles: data.roles ?? [],
    plans: data.plans ?? [],
    trialStatus: Array.isArray(data.trialStatus)
      ? data.trialStatus
      : data.trialStatus
        ? [data.trialStatus]
        : [],
    earlyAdopter: Boolean(data.earlyAdopter),
    region: data.region ?? null,
    platform: data.platform ?? [],
    product: data.product ?? [],
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: formSchema},
    onSubmit: ({value}) => {
      const payload = {
        title: value.title,
        message: value.message,
        link: value.link,
        dateExpires: value.dateExpires || null,
        isActive: value.isActive,
        organizations: value.organizations
          .split(',')
          .map(id => Number(id.trim()))
          .filter(id => id > 0),
        roles: value.roles,
        plans: value.plans,
        trialStatus: value.trialStatus,
        earlyAdopter: value.earlyAdopter,
        platform: value.platform,
        product: value.product,
        ...(value.region ? {region: value.region} : {}),
        ...(value.mediaUrl ? {mediaUrl: value.mediaUrl} : {}),
        ...(value.category ? {category: value.category} : {}),
      };
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
        <form.AppField name="title">
          {field => (
            <field.Layout.Stack label="Title" required>
              <field.Input
                value={field.state.value ?? ''}
                onChange={field.handleChange}
                maxLength={64}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="message">
          {field => (
            <field.Layout.Stack label="Message" required>
              <field.Input
                value={field.state.value ?? ''}
                onChange={field.handleChange}
                maxLength={256}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="link">
          {field => (
            <field.Layout.Stack label="Link" required>
              <field.Input
                value={field.state.value ?? ''}
                onChange={field.handleChange}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="organizations">
          {field => (
            <field.Layout.Stack
              label="Organization IDs"
              hintText="Comma-separated list of organization IDs to restrict this broadcast to. If left empty, the broadcast will be shown to all users."
            >
              <field.Input value={field.state.value} onChange={field.handleChange} />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="mediaUrl">
          {field => (
            <field.Layout.Stack
              label="Media URL"
              hintText="Optional. Image or video shown in What's New."
            >
              <field.Input
                value={field.state.value ?? ''}
                onChange={field.handleChange}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="category">
          {field => (
            <field.Layout.Stack label="Category">
              <field.Select
                value={field.state.value}
                onChange={field.handleChange}
                options={CATEGORYCHOICES.map(
                  ([value, label]): {label: string; value: string} => ({value, label})
                )}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="dateExpires">
          {field => (
            <field.Layout.Stack label="Expires">
              <field.Input
                type="datetime-local"
                value={field.state.value ?? ''}
                onChange={field.handleChange}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="isActive">
          {field => (
            <Flex align="center" gap="sm" width="fit-content">
              <Text
                as="label"
                bold={false}
                htmlFor={`${field.form.formId}${field.name}`}
                textWrap="nowrap"
              >
                Active
              </Text>
              <field.Switch
                checked={Boolean(field.state.value)}
                onChange={field.handleChange}
              />
            </Flex>
          )}
        </form.AppField>
        <form.AppField name="roles">
          {field => (
            <field.Layout.Stack label="Roles">
              <field.Select
                multiple
                value={field.state.value}
                onChange={field.handleChange}
                options={ROLECHOICES.map(
                  ([value, label]): {label: string; value: string} => ({value, label})
                )}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="plans">
          {field => (
            <field.Layout.Stack label="Plans">
              <field.Select
                multiple
                value={field.state.value}
                onChange={field.handleChange}
                options={ALL_PLANCHOICES.map(
                  ([value, label]): {label: string; value: string} => ({value, label})
                )}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="trialStatus">
          {field => (
            <field.Layout.Stack label="Trial Status">
              <field.Select
                multiple
                value={field.state.value}
                onChange={field.handleChange}
                options={TRIALCHOICES.map(
                  ([value, label]): {label: string; value: string} => ({value, label})
                )}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="earlyAdopter">
          {field => (
            <Flex align="center" gap="sm" width="fit-content">
              <Text
                as="label"
                bold={false}
                htmlFor={`${field.form.formId}${field.name}`}
                textWrap="nowrap"
              >
                Early Adopter
              </Text>
              <field.Switch checked={field.state.value} onChange={field.handleChange} />
            </Flex>
          )}
        </form.AppField>
        <form.AppField name="region">
          {field => (
            <field.Layout.Stack label="Region">
              <field.Select
                clearable
                value={field.state.value}
                onChange={field.handleChange}
                options={REGIONCHOICES.map(
                  ([value, label]): {label: string; value: string} => ({value, label})
                )}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="platform">
          {field => (
            <field.Layout.Stack label="Platform">
              <field.Select
                multiple
                value={field.state.value}
                onChange={field.handleChange}
                options={platformOptions.flatMap(group => group.options)}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="product">
          {field => (
            <field.Layout.Stack label="Product">
              <field.Select
                multiple
                value={field.state.value}
                onChange={field.handleChange}
                options={PRODUCTCHOICES.map(
                  ([value, label]): {label: string; value: string} => ({value, label})
                )}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <Flex gap="sm" justify="end">
          <Button onClick={onCancel}>Cancel</Button>
          <form.SubmitButton>Save Changes</form.SubmitButton>
        </Flex>
      </Stack>
    </form.AppForm>
  );
}
