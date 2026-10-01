import {Fragment} from 'react';
import {useMutation} from '@tanstack/react-query';
import moment from 'moment-timezone';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {Broadcast} from 'sentry/types/system';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';
import {useNavigate} from 'sentry/utils/useNavigate';

import {
  AVAILABLE_PLANCHOICES,
  CATEGORYCHOICES,
  platformOptions,
  PRODUCTCHOICES,
  REGIONCHOICES,
  ROLECHOICES,
  TRIALCHOICES,
} from 'getsentry/utils/broadcasts';

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(64),
  message: z.string().min(1, 'Message is required').max(256),
  link: z.string().min(1, 'Link is required').pipe(z.url('Invalid URL')),
  organizations: z.string(),
  mediaUrl: z.union([z.literal(''), z.url('Invalid image URL')]),
  category: z.string(),
  region: z.string(),
  platform: z.array(z.string()),
  product: z.array(z.string()),
  roles: z.array(z.string()),
  plans: z.array(z.string()),
  trialStatus: z.array(z.string()),
  earlyAdopter: z.boolean(),
  dateExpires: z.string(),
  isActive: z.boolean(),
});

type CreateBroadcastPayload = Omit<
  z.infer<typeof schema>,
  'organizations' | 'category' | 'mediaUrl' | 'region'
> & {
  category?: string;
  mediaUrl?: string;
  organizations?: number[];
  region?: string;
};

const options = (choices: ReadonlyArray<readonly [string, string]>) =>
  choices.map(([value, label]) => ({value, label}));

export function CreateBroadcastModal({
  Header,
  Body,
  Footer,
  closeModal,
}: ModalRenderProps) {
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: (data: CreateBroadcastPayload) =>
      fetchMutation<Broadcast>({
        url: getApiUrl('/broadcasts/'),
        method: 'POST',
        data,
      }),
    onSuccess: data => navigate(`/_admin/broadcasts/${data.id}/`),
    onError: error => {
      if (
        error instanceof RequestError &&
        setFieldErrors(form, requestErrorToFieldErrors(error, form.state.values))
      ) {
        return;
      }
      addErrorMessage('An error occurred while submitting this form.');
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      title: '',
      message: '',
      link: '',
      organizations: '',
      mediaUrl: '',
      category: '',
      region: '',
      platform: [] as string[],
      product: [] as string[],
      roles: [] as string[],
      plans: [] as string[],
      trialStatus: [] as string[],
      earlyAdopter: false,
      dateExpires: moment().add(7, 'days').format('YYYY-MM-DDTHH:mm'),
      isActive: true,
    },
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      const {organizations, ...rest} = value;
      const payload = {
        ...rest,
        category: value.category || undefined,
        mediaUrl: value.mediaUrl || undefined,
        region: value.region || undefined,
        organizations: organizations.trim()
          ? organizations
              .split(',')
              .map(id => Number(id.trim()))
              .filter(id => id > 0)
          : undefined,
      };
      return mutation.mutateAsync(payload).catch(() => {});
    },
  });

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h3">Add Broadcast</Heading>
      </Header>
      <form.AppForm form={form}>
        <Body>
          <Stack gap="lg">
            <form.AppField name="title">
              {field => (
                <field.Layout.Stack label="Title" required>
                  <field.Input
                    value={field.state.value}
                    onChange={field.handleChange}
                    placeholder="e.g. Shiny New Feature"
                    maxLength={64}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
            <form.AppField name="message">
              {field => (
                <field.Layout.Stack label="Message" required>
                  <field.Input
                    value={field.state.value}
                    onChange={field.handleChange}
                    placeholder="e.g. Here's a slightly longer sentence about this shiny new feature"
                    maxLength={256}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
            <form.AppField name="link">
              {field => (
                <field.Layout.Stack label="Link" required>
                  <field.Input
                    type="url"
                    value={field.state.value}
                    onChange={field.handleChange}
                    placeholder="e.g. https://blog.sentry.io/2021/01/01/shiny-new-feature"
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
                    value={field.state.value}
                    onChange={field.handleChange}
                    placeholder="e.g. 123, 456, 789 (leave empty to broadcast to all users)"
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
            <form.AppField name="mediaUrl">
              {field => (
                <field.Layout.Stack
                  label="Image URL"
                  hintText="To prevent blurriness, make sure the screenshot focuses on the key feature without including unrelated elements. Resize your browser window if needed before taking the screenshot."
                >
                  <field.Input
                    type="url"
                    value={field.state.value}
                    onChange={field.handleChange}
                    placeholder="e.g. https://example.com/image.png"
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
                    options={options(CATEGORYCHOICES)}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
            <form.AppField name="region">
              {field => (
                <field.Layout.Stack label="Region">
                  <field.Select
                    value={field.state.value}
                    onChange={field.handleChange}
                    options={options(REGIONCHOICES)}
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
                    options={options(PRODUCTCHOICES)}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
            <form.AppField name="roles">
              {field => (
                <field.Layout.Stack label="Roles">
                  <field.Select
                    multiple
                    value={field.state.value}
                    onChange={field.handleChange}
                    options={options(ROLECHOICES)}
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
                    options={options(AVAILABLE_PLANCHOICES)}
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
                    options={options(TRIALCHOICES)}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
            <form.AppField name="earlyAdopter">
              {field => (
                <field.Layout.Row label="Early Adopter">
                  <field.Switch
                    checked={field.state.value}
                    onChange={field.handleChange}
                  />
                </field.Layout.Row>
              )}
            </form.AppField>
            <form.AppField name="dateExpires">
              {field => (
                <field.Layout.Stack
                  label="Expires At"
                  hintText="The broadcast will automatically deactivate upon expiration."
                >
                  <field.Input
                    type="datetime-local"
                    value={field.state.value}
                    onChange={field.handleChange}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
            <form.AppField name="isActive">
              {field => (
                <field.Layout.Row
                  label="Active"
                  hintText="Activate this broadcast immediately."
                >
                  <field.Switch
                    checked={field.state.value}
                    onChange={field.handleChange}
                  />
                </field.Layout.Row>
              )}
            </form.AppField>
          </Stack>
        </Body>
        <Footer>
          <Flex gap="md" justify="end">
            <Button onClick={closeModal}>Cancel</Button>
            <form.SubmitButton>Save</form.SubmitButton>
          </Flex>
        </Footer>
      </form.AppForm>
    </Fragment>
  );
}
