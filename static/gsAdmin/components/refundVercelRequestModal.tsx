import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

import type {Subscription} from 'getsentry/types';

type Props = {
  onSuccess: () => void;
  subscription: Subscription;
};

type RefundVercelApiRequest = {
  guid: string;
  reason: string;
};

const schema = z.object({
  guid: z.string().trim().min(1, 'Invoice GUID is required'),
  reason: z.string().trim().min(1, 'Reason is required'),
});

type ModalProps = Props & ModalRenderProps;

function RefundVercelRequestModal({
  onSuccess,
  subscription,
  closeModal,
  Header,
  Body,
  Footer,
}: ModalProps) {
  const orgSlug = subscription.slug;

  const mutation = useMutation({
    mutationFn: (data: RefundVercelApiRequest) =>
      fetchMutation({
        url: getApiUrl('/customers/$organizationIdOrSlug/refund-vercel/', {
          path: {organizationIdOrSlug: orgSlug},
        }),
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      addSuccessMessage('Sent request to Vercel API.');
      closeModal();
      onSuccess();
    },
    onError: error => {
      addErrorMessage(
        error instanceof RequestError ? error.responseText : 'Unable to request refund.'
      );
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {guid: '', reason: ''},
    validators: {onDynamic: schema},
    onSubmit: ({value}) => mutation.mutateAsync(schema.parse(value)).catch(() => {}),
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>Initiate Vercel Refund</Header>
      <Body>
        <Stack gap="xl">
          <Text>Send request to Vercel to initiate a refund for a given invoice.</Text>
          <form.AppField name="guid">
            {field => (
              <field.Layout.Stack label="Invoice GUID" required>
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="invoice guid"
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="reason">
            {field => (
              <field.Layout.Stack label="Reason" required>
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="reason for refund"
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>Cancel</Button>
          <form.SubmitButton>Send Request</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}

type Options = Pick<Props, 'onSuccess' | 'subscription'>;

export const refundVercelRequest = (opts: Options) =>
  openModal(deps => <RefundVercelRequestModal {...deps} {...opts} />, {
    closeEvents: 'escape-key',
  });
