import type {ModalRenderProps} from 'sentry/actionCreators/modal';

import {JsonFormModal} from 'admin/components/jsonFormModal';
import {PolicyRevisionSchema} from 'admin/schemas/policies';
import type {Policy, PolicyRevision} from 'getsentry/types';

type Props = ModalRenderProps & {
  onSuccess: (revision: PolicyRevision) => void;
  policy: Policy;
};

const suggestedNextVersion = (version: string): string => {
  const v = version.split('.');
  v[1] = parseInt(v[1]!, 10) + 1 + '';
  return v.join('.');
};

export function PolicyRevisionModal({policy, ...props}: Props) {
  return (
    <JsonFormModal
      title="Add Revision"
      initialData={{
        version: policy.version ? suggestedNextVersion(policy.version) : '1.0.0',
        current: true,
      }}
      apiMethod="POST"
      apiEndpoint={`/policies/${policy.slug}/revisions/`}
      fields={PolicyRevisionSchema}
      {...props}
    />
  );
}
