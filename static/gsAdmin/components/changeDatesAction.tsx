import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Heading} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal, type ModalRenderProps} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import InputField from 'sentry/components/forms/fields/inputField';
import Form from 'sentry/components/forms/form';
import type {OnSubmitCallback} from 'sentry/components/forms/types';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';

import type {Subscription} from 'getsentry/types';

interface ChangeDatesModalProps extends ModalRenderProps {
  onSuccess: () => void;
  orgId: string;
  subscription: Subscription;
}

function ChangeDatesModal({
  orgId,
  subscription,
  onSuccess,
  closeModal,
  Header,
  Body,
}: ChangeDatesModalProps) {
  const {mutateAsync: updateSubscriptionDates, isPending: isUpdating} = useMutation<
    Record<string, any>,
    unknown,
    Record<string, any>
  >({
    mutationFn: (payload: Record<string, any>) =>
      fetchMutation({
        url: `/customers/${orgId}/`,
        method: 'PUT',
        data: payload,
      }),
  });

  const onSubmit: OnSubmitCallback = async (formData, onSubmitSuccess, onSubmitError) => {
    try {
      const postData: Record<string, any> = {
        onDemandPeriodStart: subscription.onDemandPeriodStart,
        onDemandPeriodEnd: subscription.onDemandPeriodEnd,
        contractPeriodStart: subscription.contractPeriodStart,
        contractPeriodEnd: subscription.contractPeriodEnd,
      };

      for (const k in formData) {
        if (formData[k] !== '' && formData[k]) {
          postData[k] = formData[k];
        }
      }

      const response = await updateSubscriptionDates(postData);

      addSuccessMessage('Contract and on-demand period dates updated');
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
        <Heading as="h3">Change Contract and Current On-Demand Period Dates</Heading>
      </Header>
      <Body>
        <Form
          onSubmit={onSubmit}
          onCancel={closeModal}
          submitLabel="Submit"
          submitDisabled={isUpdating}
          cancelLabel="Cancel"
        >
          <Alert.Container>
            <Alert variant="info" showIcon={false}>
              This overrides the current contract and on-demand period dates so the
              subscription may fall into a weird state.
            </Alert>
          </Alert.Container>
          <p>
            To end the contract period immediately, use the "End Billing Period
            Immediately" action.
          </p>
          <DateField
            label="On-Demand Period Start Date"
            name="onDemandPeriodStart"
            help="The new start date for the on-demand period."
            defaultValue={subscription.onDemandPeriodStart}
            type="date"
          />
          <DateField
            label="On-Demand Period End Date"
            name="onDemandPeriodEnd"
            help="The new end date for the on-demand period."
            defaultValue={subscription.onDemandPeriodEnd}
            type="date"
          />
          <DateField
            label="Contract Period Start Date"
            name="contractPeriodStart"
            help="The new start date for the contract period."
            defaultValue={subscription.contractPeriodStart}
            type="date"
          />
          <DateField
            label="Contract Period End Date"
            name="contractPeriodEnd"
            help="The new end date for the contract period."
            defaultValue={subscription.contractPeriodEnd}
            type="date"
          />
        </Form>
      </Body>
    </Fragment>
  );
}

type Options = Omit<ChangeDatesModalProps, keyof ModalRenderProps>;

const triggerChangeDatesModal = (opts: Options) =>
  openModal(deps => <ChangeDatesModal {...deps} {...opts} />);

export default triggerChangeDatesModal;

const DateField = styled(InputField)`
  padding-left: 0px;
`;
