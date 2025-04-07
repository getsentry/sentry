import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {useNavigate} from 'sentry/utils/useNavigate';

import JsonFormModal from 'admin/components/jsonFormModal';
import {PolicyRevisionSchema, PolicySchema} from 'admin/schemas/policies';

function AddPolicyModal(props: ModalRenderProps) {
  const navigate = useNavigate();
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
        navigate(`/_admin/policies/${data.slug}/`);
      }}
      {...props}
    />
  );
}

export default AddPolicyModal;
