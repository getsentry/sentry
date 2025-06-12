import {Fragment} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import ApiForm from 'sentry/components/forms/apiForm';

import type {Relocation} from 'admin/types';

type Props = ModalRenderProps & {
  relocation: Relocation;
  onSuccess?: (relocation: Relocation) => void;
};

function RelocationAbortModal({Body, Header, relocation, onSuccess, closeModal}: Props) {
  return (
    <Fragment>
      <Header closeButton>Abort Relocation</Header>
      <Body>
        <ApiForm
          apiMethod="PUT"
          apiEndpoint={`/relocations/${relocation.uuid}/abort/`}
          hostOverride={relocation.region.url}
          onSubmitSuccess={(rawRelocation: Relocation) => {
            if (onSuccess) {
              onSuccess(rawRelocation);
            }
            closeModal();
            addSuccessMessage(
              'This relocation will be immediately halted at the next opportunity.'
            );
          }}
          onSubmitError={error => {
            addErrorMessage(error.responseJSON?.detail);
          }}
          submitLabel="Abort"
          submitPriority="danger"
        >
          <p>
            This is a potentially dangerous, irreversible operation! Please be sure that
            you know what you're doing before aborting this relocation!
          </p>
        </ApiForm>
      </Body>
    </Fragment>
  );
}

export default RelocationAbortModal;
