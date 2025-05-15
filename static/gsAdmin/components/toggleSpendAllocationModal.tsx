import {Fragment} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import Form from 'sentry/components/forms/form';
import withApi from 'sentry/utils/withApi';

type Props = {
  api: Client;
  onUpdated: (data: any) => void;
  orgId: string;
  spendAllocationEnabled: boolean;
};

type ModalProps = Props & ModalRenderProps;

function SpendAllocationModal({
  Body,
  Header,
  closeModal,
  api,
  onUpdated,
  orgId,
  spendAllocationEnabled: isCurrentlyEnabled,
}: ModalProps) {
  const onSubmit = async () => {
    const shouldEnableAllocations = !isCurrentlyEnabled;
    const method = shouldEnableAllocations ? 'POST' : 'DELETE';
    try {
      await api.requestPromise(`/organizations/${orgId}/spend-allocations/toggle/`, {
        method,
      });
      // Create root allocations
      await api.requestPromise(`/organizations/${orgId}/spend-allocations/index/`, {
        method,
      });
      onUpdated({spendAllocationEnabled: shouldEnableAllocations});
    } catch (error) {
      onUpdated({error});
    }
    closeModal();
  };

  return (
    <Fragment>
      <Header>Toggle Spend Allocations</Header>
      <Body>
        <Form
          onSubmit={onSubmit}
          submitLabel={isCurrentlyEnabled ? 'Disable' : 'Enable'}
          onCancel={closeModal}
        >
          Access to spend allocations is currently{' '}
          <strong>{isCurrentlyEnabled ? 'enabled' : 'disabled'}</strong> for this
          organization.
          <p>
            Would you like to {isCurrentlyEnabled ? 'disable' : 'enable'} access to spend
            allocations?
          </p>
        </Form>
      </Body>
    </Fragment>
  );
}

const Modal = withApi(SpendAllocationModal);

type Options = Pick<Props, 'orgId' | 'spendAllocationEnabled' | 'onUpdated'>;

const toggleSpendAllocationModal = (opts: Options) =>
  openModal(deps => <Modal {...deps} {...opts} />);

export default toggleSpendAllocationModal;
