import moment from 'moment-timezone';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {Link} from 'sentry/components/core/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import ConfigStore from 'sentry/stores/configStore';
import {useApiQuery} from 'sentry/utils/queryClient';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import useApi from 'sentry/utils/useApi';
import {useParams} from 'sentry/utils/useParams';

import DetailLabel from 'admin/components/detailLabel';
import DetailList from 'admin/components/detailList';
import DetailsContainer from 'admin/components/detailsContainer';
import DetailsPage from 'admin/components/detailsPage';
import PolicyRevisionModal from 'admin/components/policies/policyRevisionModal';
import PolicyRevisions from 'admin/components/policies/policyRevisions';
import type {Policy, PolicyRevision} from 'getsentry/types';

export default function PolicyDetails() {
  const api = useApi();
  const {policySlug} = useParams();

  const {
    data: policy,
    isPending,
    isError,
    refetch,
  } = useApiQuery<Policy>([`/policies/${policySlug}/`], {
    staleTime: 0,
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const onUpdate = async (
    data: Record<string, any>,
    version: PolicyRevision['version']
  ) => {
    try {
      await api.requestPromise(`/policies/${policy.slug}/revisions/${version}/`, {
        method: 'PUT',
        data,
      });
      testableWindowLocation.reload();
    } catch {
      addErrorMessage('There was an error when updating the current policy version.');
    }
  };

  const overviewPanel = (
    <DetailsContainer>
      <DetailList>
        <DetailLabel title="Slug">
          <code>{policy.slug}</code>
        </DetailLabel>
        <DetailLabel title="Name">{policy.name}</DetailLabel>
        <DetailLabel title="Updated">{moment(policy.updatedAt).fromNow()}</DetailLabel>
      </DetailList>
      <DetailList>
        <DetailLabel title="Active?" yesNo={policy.active} />
        <DetailLabel title="Parent Policy?">
          {policy.parent ? (
            <Link to={`/_admin/policies/${policy.parent}`}>{policy.parent}</Link>
          ) : (
            'n/a'
          )}
        </DetailLabel>
        <DetailLabel title="Standalone?" yesNo={policy.standalone} />
        <DetailLabel title="Has Signature?" yesNo={policy.hasSignature} />
      </DetailList>
    </DetailsContainer>
  );

  return (
    <DetailsPage
      rootName="Policies"
      name={policy.name}
      actions={[
        {
          key: 'add-revision',
          name: 'Add Revision',
          help: 'Add a new version of this policy.',
          skipConfirmModal: true,
          disabled: !ConfigStore.get('user').permissions.has('policies.admin'),
          onAction: () => {
            openModal(deps => (
              <PolicyRevisionModal
                {...deps}
                policy={policy}
                onSuccess={(_newRevision: PolicyRevision) => {
                  window.location.reload();
                }}
              />
            ));
          },
        },
      ]}
      sections={[
        {content: overviewPanel},
        {
          content: <PolicyRevisions policy={policy} onUpdate={onUpdate} />,
          noPanel: true,
        },
      ]}
    />
  );
}
