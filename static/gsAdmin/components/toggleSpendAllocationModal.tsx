import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import {withApi} from 'sentry/utils/withApi';

type Props = {
  api: Client;
  onUpdated: (data: any) => void;
  orgId: string;
  spendAllocationEnabled: boolean;
};

type ModalProps = Props & ModalRenderProps;

function SpendAllocationModal({
  Body,
  Footer,
  Header,
  closeModal,
  api,
  onUpdated,
  orgId,
  spendAllocationEnabled: isCurrentlyEnabled,
}: ModalProps) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {},
    onSubmit: async () => {
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
    },
  });

  return (
    <form.AppForm form={form}>
      <Header>Toggle Spend Allocations</Header>
      <Body>
        <Stack gap="md">
          <Text as="p">
            Access to spend allocations is currently{' '}
            <Text as="span" bold>
              {isCurrentlyEnabled ? 'enabled' : 'disabled'}
            </Text>{' '}
            for this organization.
          </Text>
          <Text as="p">
            Would you like to {isCurrentlyEnabled ? 'disable' : 'enable'} access to spend
            allocations?
          </Text>
        </Stack>
      </Body>
      <Footer>
        <Button onClick={closeModal}>Cancel</Button>
        <form.SubmitButton>{isCurrentlyEnabled ? 'Disable' : 'Enable'}</form.SubmitButton>
      </Footer>
    </form.AppForm>
  );
}

const Modal = withApi(SpendAllocationModal);

type Options = Pick<Props, 'orgId' | 'spendAllocationEnabled' | 'onUpdated'>;

export const toggleSpendAllocationModal = (opts: Options) =>
  openModal(deps => <Modal {...deps} {...opts} />);
