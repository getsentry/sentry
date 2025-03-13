import {Fragment} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {APIRequestMethod} from 'sentry/api';
import ApiForm from 'sentry/components/forms/apiForm';
import type {FormProps} from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {FieldObject} from 'sentry/components/forms/types';

interface JsonFormModalProps extends ModalRenderProps, Pick<FormProps, 'onSubmitError'> {
  apiEndpoint: string;
  // XXX(dcramer): as of the time of writing, apiMethod is forced to be `APIRequestMethod` which is an an allow-list of HTTP verbs.
  apiMethod: APIRequestMethod;
  fields: FieldObject[];
  onSuccess: (data: any) => void;
  title: string;
  initialData?: any;
}

function JsonFormModal({
  Body,
  Header,
  closeModal,
  title,
  apiEndpoint,
  apiMethod,
  initialData = {},
  fields,
  onSuccess,
  onSubmitError,
}: JsonFormModalProps) {
  return (
    <Fragment>
      <Header closeButton>{title}</Header>
      <Body>
        <ApiForm
          apiMethod={apiMethod}
          apiEndpoint={apiEndpoint}
          onSubmitSuccess={(data: any) => {
            if (onSuccess) {
              onSuccess(data);
            }
            closeModal();
          }}
          onSubmitError={onSubmitError}
          initialData={initialData}
          submitLabel="Save Changes"
        >
          <JsonForm fields={fields} />
        </ApiForm>
      </Body>
    </Fragment>
  );
}

export default JsonFormModal;
