import {Fragment} from 'react';
import {useMutation} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

type Props = {
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
  onUpdated,
  orgId,
  spendAllocationEnabled: isCurrentlyEnabled,
}: ModalProps) {
  const spendAllocationEnabled = !isCurrentlyEnabled;
  const method = spendAllocationEnabled ? 'POST' : 'DELETE';
  const mutation = useMutation({
    mutationFn: async () => {
      await fetchMutation({
        url: getApiUrl('/organizations/$organizationIdOrSlug/spend-allocations/toggle/', {
          path: {organizationIdOrSlug: orgId},
        }),
        method,
      });
      // Create root allocations
      await fetchMutation({
        url: getApiUrl('/organizations/$organizationIdOrSlug/spend-allocations/index/', {
          path: {organizationIdOrSlug: orgId},
        }),
        method,
      });
    },
    onSuccess: () => {
      onUpdated({spendAllocationEnabled});
    },
    onError: error => {
      onUpdated({error});
    },
    onSettled: () => {
      closeModal();
    },
  });

  return (
    <Fragment>
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
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => mutation.mutate()}
            busy={mutation.isPending}
          >
            {isCurrentlyEnabled ? 'Disable' : 'Enable'}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  );
}

type Options = Pick<Props, 'orgId' | 'spendAllocationEnabled' | 'onUpdated'>;

export const toggleSpendAllocationModal = (opts: Options) =>
  openModal(deps => <SpendAllocationModal {...deps} {...opts} />);
