import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
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

type Props = {
  broadcastId: string;
  data: Record<string, any>;
  onCancel: () => void;
  onSaved: () => void;
};

const toOptions = (choices: ReadonlyArray<readonly string[]>) =>
  choices.map(choice => ({value: choice[0]!, label: choice[1]!}));

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
  trialStatus: z.string().nullable(),
  earlyAdopter: z.boolean(),
  region: z.string().nullable(),
  platform: z.array(z.string()),
  product: z.array(z.string()),
});

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

  const defaultValues: z.input<typeof formSchema> = {
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
    validators: {onDynamic: formSchema},
    onSubmit: ({value}) => {
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
        <form.AppField name="title">
          {field => (
            <field.Layout.Stack label="Title" required>
              <field.Input
                value={typeof field.state.value === 'string' ? field.state.value : ''}
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
                value={typeof field.state.value === 'string' ? field.state.value : ''}
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
                value={typeof field.state.value === 'string' ? field.state.value : ''}
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
              <field.Input
                value={typeof field.state.value === 'string' ? field.state.value : ''}
                onChange={field.handleChange}
              />
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
                value={typeof field.state.value === 'string' ? field.state.value : ''}
                onChange={field.handleChange}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="category">
          {field => (
            <field.Layout.Stack label="Category">
              <field.Select
                clearable
                value={typeof field.state.value === 'string' ? field.state.value : null}
                onChange={field.handleChange}
                options={toOptions(CATEGORYCHOICES)}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="dateExpires">
          {field => (
            <field.Layout.Stack label="Expires">
              <field.Input
                type="datetime-local"
                value={typeof field.state.value === 'string' ? field.state.value : ''}
                onChange={field.handleChange}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="isActive">
          {field => (
            <field.Layout.Row label="Active">
              <field.Switch
                checked={Boolean(field.state.value)}
                onChange={field.handleChange}
              />
            </field.Layout.Row>
          )}
        </form.AppField>
        <form.AppField name="roles">
          {field => (
            <field.Layout.Stack label="Roles">
              <field.Select
                multiple
                value={Array.isArray(field.state.value) ? field.state.value : []}
                onChange={field.handleChange}
                options={toOptions(ROLECHOICES)}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="plans">
          {field => (
            <field.Layout.Stack label="Plans">
              <field.Select
                multiple
                value={Array.isArray(field.state.value) ? field.state.value : []}
                onChange={field.handleChange}
                options={toOptions(ALL_PLANCHOICES)}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="trialStatus">
          {field => (
            <field.Layout.Stack label="Trial Status">
              <field.Select
                clearable
                value={typeof field.state.value === 'string' ? field.state.value : null}
                onChange={field.handleChange}
                options={toOptions(TRIALCHOICES)}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="earlyAdopter">
          {field => (
            <field.Layout.Row label="Early Adopter">
              <field.Switch
                checked={Boolean(field.state.value)}
                onChange={field.handleChange}
              />
            </field.Layout.Row>
          )}
        </form.AppField>
        <form.AppField name="region">
          {field => (
            <field.Layout.Stack label="Region">
              <field.Select
                clearable
                value={typeof field.state.value === 'string' ? field.state.value : null}
                onChange={field.handleChange}
                options={toOptions(REGIONCHOICES)}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="platform">
          {field => (
            <field.Layout.Stack label="Platform">
              <field.Select
                multiple
                value={Array.isArray(field.state.value) ? field.state.value : []}
                onChange={field.handleChange}
                options={toOptions(PLATFORMCHOICES)}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="product">
          {field => (
            <field.Layout.Stack label="Product">
              <field.Select
                multiple
                value={Array.isArray(field.state.value) ? field.state.value : []}
                onChange={field.handleChange}
                options={toOptions(PRODUCTCHOICES)}
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
