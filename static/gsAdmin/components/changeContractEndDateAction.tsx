import {Fragment} from 'react';
import moment from 'moment-timezone';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {DateTimeField} from 'sentry/components/deprecatedforms/dateTimeField';
import Form from 'sentry/components/deprecatedforms/form';
import withFormContext from 'sentry/components/deprecatedforms/withFormContext';

class DateFieldNoContext extends DateTimeField {
  getType() {
    return 'date';
  }
}

const DateField = withFormContext(DateFieldNoContext);

type Props = {
  contractPeriodEnd: string;
  onAction: (data: any) => void;
};

const openActionModal = ({onAction, contractPeriodEnd}: Props) =>
  openModal(({Header, Body, closeModal}) => (
    <Fragment>
      <Header>Update Contract End Date</Header>
      <Body>
        <Form
          onSubmit={formData => {
            const postData = {contractPeriodEnd};

            for (const k in formData) {
              if (formData[k] !== '' && formData[k] !== null) {
                // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                postData[k] = formData[k];
              }
            }

            onAction(postData);
            closeModal();
          }}
          onCancel={closeModal}
          submitLabel="Submit"
          cancelLabel="Cancel"
          footerClass="modal-footer"
        >
          <DateField
            label="End Date"
            name="contractPeriodEnd"
            help="The date at which this contract should end."
            defaultValue={contractPeriodEnd}
          />
        </Form>
      </Body>
    </Fragment>
  ));

function ChangeContractEndDateAction(props: Props) {
  return (
    <Button priority="link" redesign size="zero" onClick={() => openActionModal(props)}>
      {moment(props.contractPeriodEnd).format('ll')}
    </Button>
  );
}

export default ChangeContractEndDateAction;
