import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import Form from 'sentry/components/deprecatedforms/form';
import NumberField from 'sentry/components/deprecatedforms/numberField';
import InputField from 'sentry/components/forms/fields/inputField';
import TextField from 'sentry/components/forms/fields/textField';
import {space} from 'sentry/styles/space';
import useApi from 'sentry/utils/useApi';

import type {Subscription} from 'getsentry/types';
import {formatBalance} from 'getsentry/utils/billing';

type Props = {
  onSuccess: () => void;
  orgId: string;
  subscription: Subscription;
};

type ModalProps = Props & ModalRenderProps;

function ChangeBalanceModal({
  orgId,
  onSuccess,
  subscription,
  closeModal,
  Header,
  Body,
}: ModalProps) {
  const [ticketUrl, setTicketUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const api = useApi();

  function coerceValue(value: number) {
    if (isNaN(value)) {
      return undefined;
    }
    return value * 100;
  }

  async function onSubmit(data: any, _onSubmitSuccess: unknown, onSubmitError: any) {
    const creditAmount = coerceValue(data.creditAmount);
    if (!creditAmount) {
      return;
    }

    // Prevent concurrent submissions
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await api.requestPromise(`/_admin/customers/${orgId}/balance-changes/`, {
        method: 'POST',
        data: {ticketUrl, notes, creditAmount},
      });

      addSuccessMessage('Customer balance updated');
      onSuccess();
      closeModal();
    } catch (err: any) {
      onSubmitError({
        responseJSON: err.responseJSON,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Fragment>
      <Header>Add or Remove Credit</Header>
      <Body>
        <p data-test-id="balance">
          <span>
            <CurrentBalance>Current Balance: </CurrentBalance>
            {formatBalance(subscription.accountBalance)}
          </span>
        </p>
        <Form
          onSubmit={onSubmit}
          onCancel={closeModal}
          submitLabel={isSubmitting ? 'Submitting...' : 'Submit'}
          submitDisabled={isSubmitting}
          cancelLabel="Cancel"
          footerClass="modal-footer"
        >
          <NumberField
            label="Credit Amount"
            name="creditAmount"
            help="Add or remove credit, in dollars"
            disabled={isSubmitting}
          />
          <AuditFields>
            <InputField
              data-test-id="url-field"
              name="ticket-url"
              type="url"
              label="TicketUrl"
              inline={false}
              stacked
              flexibleControlStateSize
              disabled={isSubmitting}
              onChange={(ticketUrlInput: any) => setTicketUrl(ticketUrlInput)}
            />
            <TextField
              data-test-id="notes-field"
              name="notes"
              label="Notes"
              inline={false}
              stacked
              flexibleControlStateSize
              maxLength={500}
              disabled={isSubmitting}
              onChange={(notesInput: any) => setNotes(notesInput)}
            />
          </AuditFields>
        </Form>
      </Body>
    </Fragment>
  );
}

type Options = Pick<Props, 'orgId' | 'subscription' | 'onSuccess'>;

const triggerChangeBalanceModal = (opts: Options) =>
  openModal(deps => <ChangeBalanceModal {...deps} {...opts} />);

const CurrentBalance = styled('span')`
  font-weight: bold;
`;

const AuditFields = styled('div')`
  margin-top: ${space(2)};
`;

export default triggerChangeBalanceModal;
