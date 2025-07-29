import {Fragment} from 'react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {type ModalRenderProps, openModal} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import {DateTimeField} from 'sentry/components/deprecatedforms/dateTimeField';
import Form from 'sentry/components/deprecatedforms/form';
import withFormContext from 'sentry/components/deprecatedforms/withFormContext';
import useApi from 'sentry/utils/useApi';

import type {Subscription} from 'getsentry/types';

type Props = {
  onSuccess: () => void;
  orgId: string;
  subscription: Subscription;
};

type ModalProps = Props & ModalRenderProps;

class DateFieldNoContext extends DateTimeField {
  getType() {
    return 'date';
  }
}

const DateField = withFormContext(DateFieldNoContext);

function ChangeDatesModal({
  orgId,
  subscription,
  onSuccess,
  closeModal,
  Header,
  Body,
}: ModalProps) {
  const api = useApi();

  async function onSubmit(formData: any, _onSubmitSuccess: unknown, onSubmitError: any) {
    try {
      const postData = {
        onDemandPeriodStart: subscription.onDemandPeriodStart,
        onDemandPeriodEnd: subscription.onDemandPeriodEnd,
        contractPeriodStart: subscription.contractPeriodStart,
        contractPeriodEnd: subscription.contractPeriodEnd,
      };

      for (const k in formData) {
        if (formData[k] !== '' && formData[k]) {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          postData[k] = formData[k];
        }
      }

      await api.requestPromise(`/customers/${orgId}/`, {
        method: 'PUT',
        data: postData,
        success: () => {
          addSuccessMessage('Contract and on-demand period dates updated');
          onSuccess();
        },
      });

      closeModal();
    } catch (err) {
      onSubmitError({
        responseJSON: err.responseJSON,
      });
    }
  }

  return (
    <Fragment>
      <Header>Change Contract and Current On-Demand Period Dates</Header>
      <Body>
        <Form
          onSubmit={onSubmit}
          onCancel={closeModal}
          submitLabel="Submit"
          cancelLabel="Cancel"
        >
          <Alert.Container>
            <Alert type="warning" showIcon={false}>
              This overrides the current contract and on-demand period dates so the
              subscription may fall into a weird state.
            </Alert>
          </Alert.Container>
          <p>To end the contract period immediately, use the End Period Now action.</p>
          <DateField
            label="On-Demand Period Start Date"
            name="onDemandPeriodStart"
            help="The new start date for the on-demand period."
            defaultValue={subscription.onDemandPeriodStart}
          />
          <DateField
            label="On-Demand Period End Date"
            name="onDemandPeriodEnd"
            help="The new end date for the on-demand period."
            defaultValue={subscription.onDemandPeriodEnd}
          />
          <DateField
            label="Contract Period Start Date"
            name="contractPeriodStart"
            help="The new start date for the contract period."
            defaultValue={subscription.contractPeriodStart}
          />
          <DateField
            label="Contract Period End Date"
            name="contractPeriodEnd"
            help="The new end date for the contract period."
            defaultValue={subscription.contractPeriodEnd}
          />
        </Form>
      </Body>
    </Fragment>
  );
}

type Options = Pick<Props, 'orgId' | 'subscription' | 'onSuccess'>;

const triggerChangeDatesModal = (opts: Options) =>
  openModal(deps => <ChangeDatesModal {...deps} {...opts} />);

export default triggerChangeDatesModal;
