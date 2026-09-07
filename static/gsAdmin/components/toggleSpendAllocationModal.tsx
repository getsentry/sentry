import {useMutation} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
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
  const mutation = useMutation({
    mutationFn: async () => {
      const shouldEnableAllocations = !isCurrentlyEnabled;
      const method = shouldEnableAllocations ? 'POST' : 'DELETE';
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
      return shouldEnableAllocations;
    },
    onSuccess: spendAllocationEnabled => {
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
    <>
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
        <Button onClick={closeModal} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => mutation.mutate()}
          busy={mutation.isPending}
        >
          {isCurrentlyEnabled ? 'Disable' : 'Enable'}
        </Button>
      </Footer>
    </>
  );
}

type Options = Pick<Props, 'orgId' | 'spendAllocationEnabled' | 'onUpdated'>;

export const toggleSpendAllocationModal = (opts: Options) =>
  openModal(deps => <SpendAllocationModal {...deps} {...opts} />);
