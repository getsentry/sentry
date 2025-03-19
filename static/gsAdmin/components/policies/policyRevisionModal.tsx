import type {ModalRenderProps} from 'sentry/actionCreators/modal';

import JsonFormModal from 'admin/components/jsonFormModal';
import {PolicyRevisionSchema} from 'admin/schemas/policies';
import type {Policy, PolicyRevision} from 'getsentry/types';

type Props = ModalRenderProps & {
  onSuccess: (revision: PolicyRevision) => void;
  policy: Policy;
  revision?: PolicyRevision;
};

const suggestedNextVersion = (version: string): string => {
  const v = version.split('.');
  v[1] = parseInt(v[1]!, 10) + 1 + '';
  return v.join('.');
};

function PolicyRevisionModal({policy, revision, ...props}: Props) {
  return (
    <JsonFormModal
      title={revision ? `Edit ${revision.version}` : 'Add Revision'}
      initialData={
        revision || {
          version: policy.version ? suggestedNextVersion(policy.version) : '1.0.0',
          current: true,
        }
      }
      apiMethod={revision ? 'PUT' : 'POST'}
      apiEndpoint={
        revision
          ? `/policies/${policy.slug}/revisions/${revision.version}/`
          : `/policies/${policy.slug}/revisions/`
      }
      fields={PolicyRevisionSchema}
      {...props}
    />
  );
}

export default PolicyRevisionModal;
