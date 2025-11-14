import {Fragment} from 'react';

import {Flex} from '@sentry/scraps/layout';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {Heading, Text} from 'sentry/components/core/text';
import InputField from 'sentry/components/forms/fields/inputField';
import NumberField from 'sentry/components/forms/fields/numberField';
import TextField from 'sentry/components/forms/fields/textField';
import Form, {type FormProps} from 'sentry/components/forms/form';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';

import type {Subscription} from 'getsentry/types';
import {formatBalance} from 'getsentry/utils/billing';

function coerceValue(value: number) {
  if (isNaN(value)) {
    return undefined;
  }
  return value * 100;
}

type OnSubmitArgs = Parameters<NonNullable<FormProps['onSubmit']>>;
interface MutationVariables {
  creditAmount: number;
  notes: string;
  onSubmitError: OnSubmitArgs[2];
  onSubmitSuccess: OnSubmitArgs[1];
  ticketUrl: string;
}

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
}: ChangeBalanceModalProps) {
  const {mutate, isPending} = useMutation<
    Record<string, any>,
    RequestError,
    MutationVariables
  >({
    mutationFn: ({creditAmount, ticketUrl, notes}) =>
      fetchMutation({
        method: 'POST',
        url: `/_admin/customers/${orgId}/balance-changes/`,
        data: {
          ticketUrl,
          notes,
          creditAmount,
        },
      }),
    onSuccess: (response, {onSubmitSuccess}) => {
      onSubmitSuccess?.(response);
      addSuccessMessage('Customer balance updated');
      onSuccess();
      closeModal();
    },
    onError: (error, {onSubmitError}) => {
      onSubmitError?.({
        responseJSON: error?.responseJSON,
      });
    },
  });

  const onSubmit: NonNullable<FormProps['onSubmit']> = (
    data,
    onSubmitSuccess,
    onSubmitError
  ) => {
    const creditAmountInput = Number(data.creditAmount);
    const creditAmount = coerceValue(creditAmountInput);
    const ticketUrl = typeof data.ticketUrl === 'string' ? data.ticketUrl : '';
    const notes = typeof data.notes === 'string' ? data.notes : '';

    if (!creditAmount || isPending) {
      return;
    }

    mutate({
      creditAmount,
      ticketUrl,
      notes,
      onSubmitSuccess,
      onSubmitError,
    });
  };

  return (
    <Fragment>
      <Header>
        <Heading as="h2">Add or Remove Credit</Heading>
      </Header>
      <Body>
        <p data-test-id="balance">
          <span>
            <Text bold>Current Balance: </Text>
            {formatBalance(subscription.accountBalance)}
          </span>
        </p>
        <Form
          onSubmit={onSubmit}
          onCancel={closeModal}
          submitLabel={isPending ? 'Submitting...' : 'Submit'}
          submitDisabled={isPending}
          cancelLabel="Cancel"
          footerClass="modal-footer"
        >
          <Flex direction="column" gap="md">
            <NumberField
              label="Credit Amount"
              name="creditAmount"
              help="Add or remove credit, in dollars"
              disabled={isPending}
              inline={false}
              stacked
            />
            <div>
              <InputField
                name="ticketUrl"
                type="url"
                label="Ticket URL"
                inline={false}
                stacked
                disabled={isPending}
              />
              <TextField
                name="notes"
                label="Notes"
                inline={false}
                stacked
                maxLength={500}
                disabled={isPending}
              />
            </div>
          </Flex>
        </Form>
      </Body>
    </Fragment>
  );
}

const triggerChangeBalanceModal = (
  opts: Omit<ChangeBalanceModalProps, keyof ModalRenderProps>
) => openModal(deps => <ChangeBalanceModal {...deps} {...opts} />);

export default triggerChangeBalanceModal;
