import {useState} from 'react';

import {Button} from '@sentry/scraps/button';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {InputField} from 'sentry/components/forms/fields/inputField';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';

const DEFAULT_PARALLEL_LIMIT = 20;

interface ChangeDashboardsParallelLimitModalProps extends ModalRenderProps {
  onSuccess: () => void;
  organization: Organization;
}

function ChangeDashboardsParallelLimitModal({
  Header,
  Body,
  Footer,
  closeModal,
  organization,
  onSuccess,
}: ChangeDashboardsParallelLimitModalProps) {
  const currentLimit =
    organization.dashboardsAsyncQueueParallelLimit ?? DEFAULT_PARALLEL_LIMIT;
  const [limit, setLimit] = useState<number>(currentLimit);

  const {isPending, mutate} = useMutation({
    mutationFn: (newLimit: number) =>
      fetchMutation({
        method: 'PUT',
        url: `/organizations/${organization.slug}/`,
        data: {dashboardsAsyncQueueParallelLimit: newLimit},
      }),
    onMutate: () => addLoadingMessage('Saving changes\u2026'),
    onSuccess: () => {
      addSuccessMessage('Dashboard parallel query limit updated.');
      onSuccess();
      closeModal();
    },
    onError: () => {
      addErrorMessage('Failed to update dashboard parallel query limit.');
    },
  });

  return (
    <div>
      <Header closeButton>
        <h4>Change Dashboard Parallel Query Limit</h4>
      </Header>
      <Body>
        <p>
          Controls how many dashboard widget queries can run in parallel. Current value:{' '}
          <strong>{currentLimit}</strong>.
        </p>
        <InputField
          name="dashboardsAsyncQueueParallelLimit"
          label="Parallel Limit"
          type="number"
          min={1}
          inline={false}
          stacked
          flexibleControlStateSize
          value={limit}
          onChange={(val: any) => setLimit(Number(val))}
        />
      </Body>
      <Footer>
        <Button onClick={closeModal}>Cancel</Button>
        <Button
          priority="primary"
          disabled={isPending || limit < 1}
          onClick={() => mutate(limit)}
        >
          Save
        </Button>
      </Footer>
    </div>
  );
}

export function openChangeDashboardsParallelLimitModal({
  organization,
  onSuccess,
}: {
  onSuccess: () => void;
  organization: Organization;
}) {
  openModal(modalProps => (
    <ChangeDashboardsParallelLimitModal
      {...modalProps}
      organization={organization}
      onSuccess={onSuccess}
    />
  ));
}
