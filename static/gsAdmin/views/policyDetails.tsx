import {useQuery, useQueryClient} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {DescriptionList} from '@sentry/scraps/descriptionList';
import {Link} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ConfigStore} from 'sentry/stores/configStore';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApi} from 'sentry/utils/useApi';
import {useParams} from 'sentry/utils/useParams';

import {DetailLabel} from 'admin/components/detailLabel';
import {DetailsContainer} from 'admin/components/detailsContainer';
import {DetailsPage} from 'admin/components/detailsPage';
import {PolicyRevisionModal} from 'admin/components/policies/policyRevisionModal';
import {PolicyRevisions} from 'admin/components/policies/policyRevisions';
import type {Policy, PolicyRevision} from 'getsentry/types';

export function PolicyDetails() {
  const {openModal} = useModal();

  const api = useApi();
  const queryClient = useQueryClient();
  const {policySlug} = useParams<{policySlug: string}>();
  const policyQueryOptions = apiOptions.as<Policy>()('/policies/$policySlug/', {
    path: {policySlug},
    staleTime: 0,
  });
  const revisionsUrl = getApiUrl('/policies/$policySlug/revisions/', {
    path: {policySlug},
  });
  const invalidatePolicyQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({queryKey: policyQueryOptions.queryKey}),
      queryClient.invalidateQueries({queryKey: [revisionsUrl]}),
    ]);

  const {data: policy, isPending, isError, refetch} = useQuery(policyQueryOptions);

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
      await invalidatePolicyQueries();
    } catch {
      addErrorMessage('There was an error when updating the current policy version.');
    }
  };

  const overviewPanel = (
    <DetailsContainer>
      <DescriptionList gap="md">
        <DetailLabel title="Slug">
          <code>{policy.slug}</code>
        </DetailLabel>
        <DetailLabel title="Name">{policy.name}</DetailLabel>
        <DetailLabel title="Updated">{moment(policy.updatedAt).fromNow()}</DetailLabel>
      </DescriptionList>
      <DescriptionList gap="md">
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
      </DescriptionList>
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
                onSuccess={invalidatePolicyQueries}
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
