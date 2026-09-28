import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';

import {PolicyFormModal} from 'admin/components/policies/policyFormModal';
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

export function PolicyRevisionModal({policy, onSuccess, ...props}: Props) {
  return (
    <PolicyFormModal
      title="Add Revision"
      initialVersion={policy.version ? suggestedNextVersion(policy.version) : '1.0.0'}
      apiEndpoint={getApiUrl('/policies/$policySlug/revisions/', {
        path: {policySlug: policy.slug},
      })}
      isNewPolicy={false}
      onSuccess={data => {
        if ('createdAt' in data) {
          onSuccess(data);
        }
      }}
      {...props}
    />
  );
}
