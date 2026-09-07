import {Fragment} from 'react';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
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
    onError: error => {
      if (
        error instanceof RequestError &&
        setFieldErrors(form, requestErrorToFieldErrors(error, form.state.values))
      ) {
        return;
      }
      addErrorMessage('Unable to update customer balance.');
    },
  });

  const defaultValues: z.input<typeof schema> = {
    creditAmount: null,
    ticketUrl: '',
    notes: '',
  };
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value}) => mutation.mutateAsync(schema.parse(value)).catch(() => {}),
  });

  return (
    <Fragment>
      <form.AppForm form={form}>
        <Header>
          <Heading as="h2">Add or Remove Credit</Heading>
        </Header>
        <Body>
          <Stack gap="lg">
            <Text>
              <Text bold>Current Balance: </Text>
              {formatBalance(subscription.accountBalance)}
            </Text>
            <form.AppField name="creditAmount">
              {field => (
                <field.Layout.Stack
                  label="Credit Amount"
                  hintText="Add or remove credit, in dollars"
                  required
                >
                  <field.Number
                    value={field.state.value}
                    onChange={field.handleChange}
                    disabled={mutation.isPending}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
            <form.AppField name="ticketUrl">
              {field => (
                <field.Layout.Stack label="Ticket URL">
                  <field.Input
                    type="url"
                    value={field.state.value}
                    onChange={field.handleChange}
                    disabled={mutation.isPending}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
            <form.AppField name="notes">
              {field => (
                <field.Layout.Stack label="Notes">
                  <field.Input
                    value={field.state.value}
                    onChange={field.handleChange}
                    maxLength={500}
                    disabled={mutation.isPending}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
          </Stack>
        </Body>
        <Footer>
          <Flex gap="md" justify="end">
            <Button onClick={closeModal}>Cancel</Button>
            <form.SubmitButton>Submit</form.SubmitButton>
          </Flex>
        </Footer>
      </form.AppForm>
    </Fragment>
  );
}

export const triggerChangeBalanceModal = (
  opts: Omit<ChangeBalanceModalProps, keyof ModalRenderProps>
) => openModal(deps => <ChangeBalanceModal {...deps} {...opts} />);
