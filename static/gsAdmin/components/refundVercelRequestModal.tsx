import {Fragment, useState} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import useApi from 'sentry/utils/useApi';

import type {Subscription} from 'getsentry/types';

type Props = {
  onSuccess: () => void;
  subscription: Subscription;
};

type RefundVercelApiRequest = {
  guid: string;
  reason: string;
};

type ModalProps = Props & ModalRenderProps;

function RefundVercelRequestModal({
  onSuccess,
  subscription,
  closeModal,
  Header,
  Body,
}: ModalProps) {
  const api = useApi();
  const [reason, setReason] = useState<string>('');
  const [guid, setGuid] = useState<string>('');
  const orgSlug = subscription.slug;

  const onSubmit = () => {
    const data: RefundVercelApiRequest = {
      guid,
      reason,
    };

    api.request(`/customers/${orgSlug}/refund-vercel/`, {
      method: 'POST',
      data,
      success: () => {
        addSuccessMessage('Sent request to Vercel API.');
        closeModal();
        onSuccess();
      },
      error: e => {
        addErrorMessage(e.responseText);
      },
    });
  };

  return (
    <Fragment>
      <Header closeButton>Initiate Vercel Refund</Header>
      <Body>
        <div>Send request to Vercel to initiate a refund for a given invoice.</div>
        <br />
        <Form onSubmit={onSubmit} submitLabel="Send Request" onCancel={closeModal}>
          <TextField
            label="Invoice GUID"
            name="invoice_guid"
            placeholder="invoice guid"
            onChange={(value: string) => {
              setGuid(value);
            }}
            required
          />
          <TextField
            label="Reason"
            name="reason"
            placeholder="reason for refund"
            onChange={(value: string) => {
              setReason(value);
            }}
            required
          />
        </Form>
      </Body>
    </Fragment>
  );
}

type Options = Pick<Props, 'onSuccess' | 'subscription'>;

const refundVercelRequest = (opts: Options) =>
  openModal(deps => <RefundVercelRequestModal {...deps} {...opts} />, {
    closeEvents: 'escape-key',
  });

export default refundVercelRequest;
