import {Fragment} from 'react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal, type ModalRenderProps} from 'sentry/actionCreators/modal';
import Form from 'sentry/components/deprecatedforms/form';
import useApi from 'sentry/utils/useApi';

import type {Subscription} from 'getsentry/types';

type Props = {
  onSuccess: () => void;
  orgId: string;
  subscription: Subscription;
};

type ModalProps = Props & ModalRenderProps;

function EndPeriodEarlyModal({orgId, onSuccess, closeModal, Header, Body}: ModalProps) {
  const api = useApi();

  async function onSubmit(_: any, _onSubmitSuccess: any, onSubmitError: any) {
    try {
      const postData = {
        endPeriodEarly: true,
      };

      await api.requestPromise(`/customers/${orgId}/`, {
        method: 'PUT',
        data: postData,
        success: () => {
          addSuccessMessage('Currrent period ended successfully');
          onSuccess();
        },
      });

      closeModal();
    } catch (err: any) {
      onSubmitError({
        responseJSON: err.responseJSON,
      });
    }
  }

  return (
    <Fragment>
      <Header>End Current Period Immediately</Header>
      <Body>
        <Form
          onSubmit={onSubmit}
          onCancel={closeModal}
          submitLabel="Submit"
          cancelLabel="Cancel"
        >
          <p>End the current billing period immediately and start a new one.</p>
        </Form>
      </Body>
    </Fragment>
  );
}

type Options = Pick<Props, 'orgId' | 'subscription' | 'onSuccess'>;

const triggerEndPeriodEarlyModal = (opts: Options) =>
  openModal(deps => <EndPeriodEarlyModal {...deps} {...opts} />);

export default triggerEndPeriodEarlyModal;
