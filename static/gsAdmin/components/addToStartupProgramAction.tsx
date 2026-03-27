import {Fragment, useState} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {InputField} from 'sentry/components/forms/fields/inputField';
import {NumberField} from 'sentry/components/forms/fields/numberField';
import {SelectField} from 'sentry/components/forms/fields/selectField';
import {TextField} from 'sentry/components/forms/fields/textField';
import {Form, type FormProps} from 'sentry/components/forms/form';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';

import type {Subscription} from 'getsentry/types';
import {formatBalance} from 'getsentry/utils/billing';

const STARTUP_PROGRAM_OPTIONS = [
  {value: 'ycombinator', label: 'Y Combinator'},
  {value: 'sentryforstartups', label: 'Sentry for Startups'},
  {value: 'a16z', label: 'a16z'},
  {value: 'accelatoms', label: 'Accelatoms'},
  {value: 'accelfam', label: 'Accelfam'},
  {value: 'renderstack', label: 'Renderstack'},
  {value: 'finpack', label: 'Finpack'},
  {value: 'betaworks', label: 'Betaworks'},
  {value: 'alchemist', label: 'Alchemist'},
  {value: 'antler', label: 'Antler'},
  {value: 'other', label: 'Other'},
];

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

interface AddToStartupProgramModalProps extends ModalRenderProps {
  onSuccess: () => void;
  orgId: string;
  subscription: Subscription;
}

function AddToStartupProgramModal({
  orgId,
  onSuccess,
  subscription,
  closeModal,
  Header,
  Body,
}: AddToStartupProgramModalProps) {
  const [showCustomNotes, setShowCustomNotes] = useState(false);

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
      addSuccessMessage('Customer added to startup program');
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
    const notesProgram = typeof data.notesProgram === 'string' ? data.notesProgram : '';
    const notes =
      notesProgram === 'other'
        ? typeof data.notesCustom === 'string'
          ? data.notesCustom
          : ''
        : notesProgram;

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
        <Heading as="h2">Add to Startup Program</Heading>
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
          initialData={{
            creditAmount: 5000,
            notesProgram: 'sentryforstartups',
            notesCustom: '',
          }}
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
              <SelectField
                name="notesProgram"
                label="Program"
                options={STARTUP_PROGRAM_OPTIONS}
                inline={false}
                stacked
                disabled={isPending}
                onChange={value => {
                  setShowCustomNotes(value === 'other');
                }}
              />
              {showCustomNotes && (
                <TextField
                  name="notesCustom"
                  label="Custom Notes"
                  inline={false}
                  stacked
                  maxLength={500}
                  disabled={isPending}
                />
              )}
            </div>
          </Flex>
        </Form>
      </Body>
    </Fragment>
  );
}

export const triggerAddToStartupProgramModal = (
  opts: Omit<AddToStartupProgramModalProps, keyof ModalRenderProps>
) => openModal(deps => <AddToStartupProgramModal {...deps} {...opts} />);
