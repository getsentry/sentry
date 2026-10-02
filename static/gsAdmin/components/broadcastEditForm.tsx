import {useMutation, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

import type {BroadcastDetailsData} from 'admin/types';
import {CATEGORYCHOICES} from 'getsentry/utils/broadcasts';

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
  mediaUrl: z.union([
    z.literal(''),
    z.url({protocol: /^https?$/, error: 'Enter a valid http or https URL'}),
  ]),
  category: z.string().nullable(),
  dateExpires: z.string(),
  isActive: z.boolean(),
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
    mediaUrl: data.mediaUrl ?? '',
    category: data.category ?? null,
    dateExpires: data.dateExpires?.slice(0, 16) ?? '',
    isActive: Boolean(data.isActive),
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
        ...(value.mediaUrl || data.mediaUrl ? {mediaUrl: value.mediaUrl || null} : {}),
        ...(value.category || data.category ? {category: value.category} : {}),
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
                value={typeof field.state.value === 'string' ? field.state.value : ''}
                onChange={field.handleChange}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="isActive">
          {field => (
            <Container width="144px">
              <field.Layout.Row label="Active">
                <field.Switch
                  checked={Boolean(field.state.value)}
                  onChange={field.handleChange}
                />
              </field.Layout.Row>
            </Container>
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
