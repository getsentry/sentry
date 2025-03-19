import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {browserHistory} from 'sentry/utils/browserHistory';

import JsonFormModal from 'admin/components/jsonFormModal';
import {PolicyRevisionSchema, PolicySchema} from 'admin/schemas/policies';

function AddPolicyModal(props: ModalRenderProps) {
  return (
    <JsonFormModal
      title="Add Policy"
      apiEndpoint="/policies/"
      apiMethod="POST"
      fields={[
        ...PolicySchema,
        ...PolicyRevisionSchema.filter(f => f.name !== 'current'),
      ]}
      onSuccess={(data: any) => {
        browserHistory.push(`/_admin/policies/${data.slug}/`);
      }}
      {...props}
    />
  );
}

export default AddPolicyModal;
