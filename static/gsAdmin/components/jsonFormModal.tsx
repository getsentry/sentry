import {Fragment} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {ApiForm} from 'sentry/components/forms/apiForm';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {FieldObject} from 'sentry/components/forms/types';
import type {RequestMethod} from 'sentry/utils/api/apiQueryKey';

interface JsonFormModalProps extends ModalRenderProps {
  apiEndpoint: string;
  apiMethod: RequestMethod;
  fields: FieldObject[];
  onSuccess: (data: any) => void;
  title: string;
  initialData?: any;
}

export function JsonFormModal({
  Body,
  Header,
  closeModal,
  title,
  apiEndpoint,
  apiMethod,
  initialData = {},
  fields,
  onSuccess,
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
          initialData={initialData}
          submitLabel="Save Changes"
        >
          <JsonForm fields={fields} />
        </ApiForm>
      </Body>
    </Fragment>
  );
}
