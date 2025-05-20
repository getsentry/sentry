import {Fragment} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import ApiForm from 'sentry/components/forms/apiForm';
import SelectField from 'sentry/components/forms/fields/selectField';

import type {Relocation} from 'admin/types';
import {RelocationSteps} from 'admin/types';
import titleCase from 'getsentry/utils/titleCase';

type Props = ModalRenderProps & {
  relocation: Relocation;
  onSuccess?: (relocation: Relocation) => void;
};

function RelocationCancelModal({Body, Header, relocation, onSuccess, closeModal}: Props) {
  const currentStep = RelocationSteps[relocation.step];
  const choices = Object.keys(RelocationSteps)
    // @ts-expect-error TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
    .filter(step => RelocationSteps[step] > currentStep && step !== 'COMPLETED')
    .map(step => [step, titleCase(step)]);
  choices.unshift(['ASAP', 'As soon as possible']);

  return (
    <Fragment>
      <Header closeButton>Cancel Relocation</Header>
      <Body>
        <ApiForm
          apiMethod="PUT"
          apiEndpoint={`/relocations/${relocation.uuid}/cancel/`}
          hostOverride={relocation.region.url}
          onSubmit={(data: Record<string, any>) => {
            const payload: Record<string, any> = {};
            if (data.atStep !== 'ASAP') {
              payload.atStep = data.atStep;
            }
            return payload;
          }}
          onSubmitSuccess={(rawRelocation: Relocation) => {
            if (onSuccess) {
              onSuccess(rawRelocation);
            }
            closeModal();
            addSuccessMessage('This relocation has been scheduled for cancellation.');
          }}
          onSubmitError={error => {
            addErrorMessage(error.responseJSON?.detail);
          }}
          initialData={relocation || {atStep: 'ASAP'}}
          submitLabel="Schedule"
        >
          <SelectField
            choices={choices}
            flexibleControlStateSize={false}
            help="Select a step to cancel PRIOR to:"
            inline={false}
            label="Scheduled At"
            name="atStep"
            stacked
            required
          />
        </ApiForm>
      </Body>
    </Fragment>
  );
}

export default RelocationCancelModal;
