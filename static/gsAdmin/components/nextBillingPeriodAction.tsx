import {Fragment} from 'react';

import {Heading} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal, type ModalRenderProps} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import Form from 'sentry/components/forms/form';
import type {OnSubmitCallback} from 'sentry/components/forms/types';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';

import type {Subscription} from 'getsentry/types';

interface EndPeriodEarlyModalProps extends ModalRenderProps {
  onSuccess: () => void;
  orgId: string;
  subscription: Subscription;
}

function EndPeriodEarlyModal({
  orgId,
  onSuccess,
  closeModal,
  Header,
  Body,
}: EndPeriodEarlyModalProps) {
  const {mutateAsync: endPeriodEarly, isPending} = useMutation<any>({
    mutationFn: () =>
      fetchMutation({
        url: `/customers/${orgId}/`,
        method: 'PUT',
        data: {endPeriodEarly: true},
      }),
  });

  const onSubmit: OnSubmitCallback = async (
    _formData,
    onSubmitSuccess,
    onSubmitError
  ) => {
    try {
      const response = await endPeriodEarly();

      addSuccessMessage('Current period ended successfully');
      onSubmitSuccess(response);
      onSuccess();
      closeModal();
    } catch (err: any) {
      onSubmitError({
        responseJSON: err.responseJSON,
      });
    }
  };

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h3">End Current Period Immediately</Heading>
      </Header>
      <Body>
        <Form
          onSubmit={onSubmit}
          onCancel={closeModal}
          submitLabel="Submit"
          submitDisabled={isPending}
          cancelLabel="Cancel"
        >
          <Alert.Container>
            <Alert variant="warning" showIcon={false}>
              Ending the current billing period will immediately start the next billing
              cycle and may impact invoicing and usage proration.
            </Alert>
          </Alert.Container>
          <p>End the current billing period immediately and start a new one.</p>
        </Form>
      </Body>
    </Fragment>
  );
}

type Options = Omit<EndPeriodEarlyModalProps, keyof ModalRenderProps>;

const triggerEndPeriodEarlyModal = (opts: Options) =>
  openModal(deps => <EndPeriodEarlyModal {...deps} {...opts} />);

export default triggerEndPeriodEarlyModal;
