import {Fragment} from 'react';

import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {NumberField} from 'sentry/components/forms/fields/numberField';
import {Form, type FormProps} from 'sentry/components/forms/form';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';

const DEFAULT_PARALLEL_LIMIT = 20;

type OnSubmitArgs = Parameters<NonNullable<FormProps['onSubmit']>>;
interface MutationVariables {
  limit: number;
  onSubmitError: OnSubmitArgs[2];
  onSubmitSuccess: OnSubmitArgs[1];
}

interface ChangeDashboardsParallelLimitModalProps extends ModalRenderProps {
  onSuccess: () => void;
  organization: Organization;
}

function ChangeDashboardsParallelLimitModal({
  Header,
  Body,
  closeModal,
  organization,
  onSuccess,
}: ChangeDashboardsParallelLimitModalProps) {
  const currentLimit =
    organization.dashboardsAsyncQueueParallelLimit ?? DEFAULT_PARALLEL_LIMIT;

  const {mutate, isPending} = useMutation<
    Record<string, any>,
    RequestError,
    MutationVariables
  >({
    mutationFn: ({limit}) =>
      fetchMutation({
        method: 'PUT',
        url: `/organizations/${organization.slug}/`,
        data: {dashboardsAsyncQueueParallelLimit: limit},
      }),
    onSuccess: (response, {onSubmitSuccess}) => {
      onSubmitSuccess?.(response);
      addSuccessMessage('Dashboard parallel query limit updated.');
      onSuccess();
      closeModal();
    },
    onError: (error, {onSubmitError}) => {
      onSubmitError?.({responseJSON: error?.responseJSON});
      addErrorMessage('Failed to update dashboard parallel query limit.');
    },
  });

  const onSubmit: NonNullable<FormProps['onSubmit']> = (
    data,
    onSubmitSuccess,
    onSubmitError
  ) => {
    const limit = Number(data.dashboardsAsyncQueueParallelLimit);

    if (!limit || limit < 1 || isPending) {
      return;
    }

    mutate({limit, onSubmitSuccess, onSubmitError});
  };

  return (
    <Fragment>
      <Header>
        <Heading as="h2">Change Dashboard Parallel Query Limit</Heading>
      </Header>
      <Body>
        <p>
          <Text bold>Current value: </Text>
          {currentLimit}
        </p>
        <Form
          onSubmit={onSubmit}
          onCancel={closeModal}
          submitLabel={isPending ? 'Submitting...' : 'Save'}
          submitDisabled={isPending}
          cancelLabel="Cancel"
          footerClass="modal-footer"
        >
          <NumberField
            label="Parallel Limit"
            name="dashboardsAsyncQueueParallelLimit"
            help="Controls how many dashboard widget queries can run in parallel."
            defaultValue={currentLimit}
            min={1}
            disabled={isPending}
            inline={false}
            stacked
          />
        </Form>
      </Body>
    </Fragment>
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
