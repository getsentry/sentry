import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Heading} from '@sentry/scraps/text';

import {openModal, type ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import InputField from 'sentry/components/forms/fields/inputField';
import Form from 'sentry/components/forms/form';
import type {OnSubmitCallback} from 'sentry/components/forms/types';

interface ChangeContractEndDateModalProps extends ModalRenderProps {
  contractPeriodEnd: string;
  onAction: (data: Record<string, any>) => Promise<unknown> | unknown;
}

function ChangeContractEndDateModal({
  contractPeriodEnd,
  onAction,
  Header,
  Body,
  closeModal,
}: ChangeContractEndDateModalProps) {
  const onSubmit: OnSubmitCallback = async (formData, onSubmitSuccess, onSubmitError) => {
    try {
      const postData: Record<string, any> = {contractPeriodEnd};

      for (const key in formData) {
        if (formData[key] !== '' && formData[key] !== null) {
          postData[key] = formData[key];
        }
      }

      await onAction(postData);
      onSubmitSuccess(postData);
      closeModal();
    } catch (err: any) {
      onSubmitError(err?.responseJSON ?? err);
    }
  };

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h3">Update Contract End Date</Heading>
      </Header>
      <Body>
        <Form
          onSubmit={onSubmit}
          onCancel={closeModal}
          submitLabel="Submit"
          cancelLabel="Cancel"
        >
          <DateField
            label="End Date"
            name="contractPeriodEnd"
            help="The date at which this contract should end."
            defaultValue={contractPeriodEnd}
            type="date"
          />
        </Form>
      </Body>
    </Fragment>
  );
}

type Options = Omit<ChangeContractEndDateModalProps, keyof ModalRenderProps>;

const openActionModal = (props: Options) =>
  openModal(deps => <ChangeContractEndDateModal {...deps} {...props} />);

function ChangeContractEndDateAction(props: Options) {
  return (
    <Button priority="link" size="zero" onClick={() => openActionModal(props)}>
      {moment(props.contractPeriodEnd).format('ll')}
    </Button>
  );
}

const DateField = styled(InputField)`
  padding-left: 0;
`;

export default ChangeContractEndDateAction;
