import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormValidators, ScrapsForm, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';

import type {Subscription} from 'getsentry/types';
import {formatBalance} from 'getsentry/utils/billing';

const schema = z.object({
  creditAmount: z
    .number()
    .nullable()
    .refine(
      (value): value is number => value !== null && value !== 0,
      'Enter a non-zero credit amount'
    ),
  ticketUrl: z.string(),
  notes: z.string().max(500),
});

interface ChangeBalanceModalProps extends ModalRenderProps {
  onSuccess: () => void;
  orgId: string;
  subscription: Subscription;
}

function ChangeBalanceModal({
  orgId,
  onSuccess,
  subscription,
  closeModal,
  Header,
  Body,
  Footer,
}: ChangeBalanceModalProps) {
  const mutation = useMutation({
    mutationFn: (data: {creditAmount: number; notes: string; ticketUrl: string}) =>
      fetchMutation({
        method: 'POST',
        url: getApiUrl('/_admin/customers/$organizationIdOrSlug/balance-changes/', {
          path: {organizationIdOrSlug: orgId},
        }),
        data: {...data, creditAmount: data.creditAmount * 100},
      }),
    onSuccess: () => {
      addSuccessMessage('Customer balance updated');
      onSuccess();
      closeModal();
    },
  });

  const defaultValues: z.input<typeof schema> = {
    creditAmount: null,
    ticketUrl: '',
    notes: '',
  };
  const form = useScrapsForm({
    defaultValues,
    validators: defaultFormValidators(schema),
    onSubmit: ({value, createValidationError}) =>
      mutation.mutateAsync(schema.parse(value)).catch(error => {
        if (error instanceof RequestError) {
          const fields = requestErrorToFieldErrors(error, value);
          if (fields) {
            return createValidationError({fields});
          }
        }
        addErrorMessage('Unable to update customer balance.');
        return;
      }),
  });

  return (
    <ScrapsForm form={form}>
      <Header>
        <Heading as="h2">Add or Remove Credit</Heading>
      </Header>
      <Body>
        <Stack gap="lg">
          <Text>
            <Text bold>Current Balance: </Text>
            {formatBalance(subscription.accountBalance)}
          </Text>
          <form.Field name="creditAmount">
            {field => (
              <field.Layout.Stack
                label="Credit Amount"
                hintText="Add or remove credit, in dollars"
                required
              >
                <field.Number
                  value={field.value}
                  onChange={field.handleChange}
                  disabled={mutation.isPending}
                />
              </field.Layout.Stack>
            )}
          </form.Field>
          <form.Field name="ticketUrl">
            {field => (
              <field.Layout.Stack label="Ticket URL">
                <field.Input
                  type="url"
                  value={field.value}
                  onChange={field.handleChange}
                  disabled={mutation.isPending}
                />
              </field.Layout.Stack>
            )}
          </form.Field>
          <form.Field name="notes">
            {field => (
              <field.Layout.Stack label="Notes">
                <field.Input
                  value={field.value}
                  onChange={field.handleChange}
                  maxLength={500}
                  disabled={mutation.isPending}
                />
              </field.Layout.Stack>
            )}
          </form.Field>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>Cancel</Button>
          <form.SubmitButton>Submit</form.SubmitButton>
        </Flex>
      </Footer>
    </ScrapsForm>
  );
}

export const triggerChangeBalanceModal = (
  opts: Omit<ChangeBalanceModalProps, keyof ModalRenderProps>
) => openModal(deps => <ChangeBalanceModal {...deps} {...opts} />);
