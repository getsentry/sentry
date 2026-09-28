import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useNavigate} from 'sentry/utils/useNavigate';

import {PolicyFormModal} from 'admin/components/policies/policyFormModal';

export function AddPolicyModal(props: ModalRenderProps) {
  const navigate = useNavigate();
  return (
    <PolicyFormModal
      title="Add Policy"
      apiEndpoint={getApiUrl('/policies/')}
      isNewPolicy
      onSuccess={data => {
        navigate(
          'slug' in data && data.slug
            ? `/_admin/policies/${data.slug}/`
            : '/_admin/policies/'
        );
      }}
      {...props}
    />
  );
}
