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

function RelocationUnpauseModal({
  Body,
  Header,
  relocation,
  onSuccess,
  closeModal,
}: Props) {
  const currentStep = RelocationSteps[relocation.step];
  const choices = Object.keys(RelocationSteps)
    // @ts-expect-error TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
    .filter(step => RelocationSteps[step] > currentStep && step !== 'COMPLETED')
    .map(step => [step, titleCase(step)]);
  choices.unshift(['NONE', 'Completion']);

  return (
    <Fragment>
      <Header closeButton>Unpause Relocation</Header>
      <Body>
        <ApiForm
          apiMethod="PUT"
          apiEndpoint={`/relocations/${relocation.uuid}/unpause/`}
          hostOverride={relocation.region.url}
          onSubmit={(data: Record<string, any>) => {
            const payload: Record<string, any> = {};
            if (data.untilStep !== 'NONE') {
              payload.untilStep = data.untilStep;
            }
            return payload;
          }}
          onSubmitSuccess={(rawRelocation: Relocation) => {
            if (onSuccess) {
              onSuccess(rawRelocation);
            }
            closeModal();
            addSuccessMessage(
              'All current or future pauses for this relocation have been removed.'
            );
          }}
          onSubmitError={error => {
            addErrorMessage(error.responseJSON?.detail);
          }}
          initialData={relocation || {untilStep: 'NONE'}}
          submitLabel="Unpause"
        >
          <SelectField
            choices={choices}
            flexibleControlStateSize={false}
            help="Optionally select another future step to pause at:"
            inline={false}
            label="Until"
            name="untilStep"
            stacked
          />
        </ApiForm>
      </Body>
    </Fragment>
  );
}

export default RelocationUnpauseModal;
