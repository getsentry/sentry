import {Fragment} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import ApiForm from 'sentry/components/forms/apiForm';

import type {Relocation} from 'admin/types';

type Props = ModalRenderProps & {
  relocation: Relocation;
  onSuccess?: (relocation: Relocation) => void;
};

function RelocationRetryModal({Body, Header, relocation, onSuccess, closeModal}: Props) {
  return (
    <Fragment>
      <Header closeButton>Retry Relocation</Header>
      <Body>
        <ApiForm
          apiMethod="POST"
          apiEndpoint={`/relocations/${relocation.uuid}/retry/`}
          hostOverride={relocation.region.url}
          onSubmitSuccess={(rawRelocation: Relocation) => {
            if (onSuccess) {
              onSuccess(rawRelocation);
            }
            closeModal();
            addSuccessMessage('This relocation is being retried.');
          }}
          onSubmitError={error => {
            addErrorMessage(error.responseJSON?.detail);
          }}
          submitLabel="Retry"
        >
          <p>
            Trigger a new relocation with all of the same user submitted data as its
            predecessor. This is useful when transient errors or since-fixed bugs cause a
            relocation attempt to fail.
          </p>
        </ApiForm>
      </Body>
    </Fragment>
  );
}

export default RelocationRetryModal;
