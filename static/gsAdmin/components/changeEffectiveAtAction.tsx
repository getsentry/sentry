import {Fragment} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import InputField from 'sentry/components/forms/fields/inputField';
import Form from 'sentry/components/forms/form';

type Props = {
  onAction: (effectiveAt: string) => void;
};

const openChangeEffectiveAtModal = ({onAction}: Props) =>
  openModal(({Header, Body, closeModal}) => (
    <Fragment>
      <Header closeButton>Change Effective At Date</Header>
      <Body>
        <Form
          requireChanges
          onSubmit={data => {
            onAction(data.effectiveAt);
            closeModal();
          }}
          onCancel={closeModal}
          submitLabel="Submit"
          cancelLabel="Cancel"
        >
          <DateField
            type="date"
            label="Effective At"
            name="effectiveAt"
            help="Invoice date used for ARR calculations"
          />
        </Form>
      </Body>
    </Fragment>
  ));

const DateField = styled(InputField)`
  padding-left: 0px;
`;

export default openChangeEffectiveAtModal;
