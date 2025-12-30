import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {DocIntegrationAvatar} from 'sentry/components/core/avatar/docIntegrationAvatar';
import {Tag} from 'sentry/components/core/badge/tag';
import {ExternalLink} from 'sentry/components/core/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {DocIntegration} from 'sentry/types/integrations';
import {
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';

import DetailLabel from 'admin/components/detailLabel';
import DetailList from 'admin/components/detailList';
import DetailsContainer from 'admin/components/detailsContainer';
import type {ActionItem} from 'admin/components/detailsPage';
import DetailsPage from 'admin/components/detailsPage';
import DocIntegrationModal from 'admin/components/docIntegrationModal';

export default function DocIntegrationDetails() {
  const {docIntegrationSlug} = useParams<{docIntegrationSlug: string}>();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const ENDPOINT = `/doc-integrations/${docIntegrationSlug}/`;

  const {data, isPending, isError, refetch} = useApiQuery<any>([ENDPOINT], {
    staleTime: 0,
  });

  const onUpdateMutation = useMutation({
    mutationFn: (params: Record<string, any>) => {
      return api.requestPromise(ENDPOINT, {
        method: 'PUT',
        data: params,
      });
    },
    onMutate: () => {
      addLoadingMessage('Saving changes...');
    },
    onSuccess: updatedData => {
      addSuccessMessage(`Resource has been updated with ${JSON.stringify(updatedData)}.`);
      clearIndicators();
      setApiQueryData<any>(queryClient, [ENDPOINT], updatedData);
    },
    onError: () => {
      addErrorMessage('There was an internal error with updating the resource.');
      clearIndicators();
    },
  });

  const onDeleteMutation = useMutation({
    mutationFn: () => {
      return api.requestPromise(ENDPOINT, {
        method: 'DELETE',
      });
    },
    onMutate: () => {
      addLoadingMessage('Deleting doc integration...');
    },
    onSuccess: () => {
      addSuccessMessage('Resource has been deleted.');
      navigate('_admin/doc-integrations/');
      clearIndicators();
    },
    onError: () => {
      addErrorMessage('There was an internal error with deleting the resource.');
      clearIndicators();
    },
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const publishingAction: ActionItem =
    data.isDraft === true
      ? {
          key: 'publish',
          name: 'Publish App',
          help: 'Publishes this Doc Integration',
          skipConfirmModal: true,
          onAction: () =>
            onUpdateMutation.mutate({
              ...data,
              is_draft: false,
              features: data?.features?.map(({featureId}: any) => featureId),
            }),
        }
      : {
          key: 'unpublish',
          name: 'Unpublish App',
          help: 'Revert This Doc Integration to Draft Mode',
          skipConfirmModal: true,
          onAction: () =>
            onUpdateMutation.mutate({
              ...data,
              is_draft: true,
              features: data?.features?.map(({featureId}: any) => featureId),
            }),
        };

  const updateDetailsAction = {
    key: 'update-details',
    name: 'Update Details',
    help: 'Update the details of this Doc Integration (e.g. popularity)',
    skipConfirmModal: true,
    onAction: () => {
      openModal(deps => (
        <DocIntegrationModal
          {...deps}
          docIntegration={data}
          onSubmit={(docIntegration: DocIntegration) => {
            setApiQueryData<any>(queryClient, [ENDPOINT], docIntegration);
          }}
        />
      ));
    },
  };

  const deleteAction: ActionItem = {
    key: 'delete-doc-integration',
    name: 'Delete Doc Integration',
    help: '🚨 Delete this Doc Integration FOREVER (irreversible) 🚨',
    confirmModalOpts: {
      showAuditFields: false,
      priority: 'danger',
      confirmText: 'Delete Doc Integration 😨',
    },
    onAction: () => onDeleteMutation.mutate(),
  };

  const actions = [updateDetailsAction, publishingAction, deleteAction];

  const overview = (
    <DetailsContainer>
      <DetailList>
        <DetailLabel title="Name">{data.name}</DetailLabel>
        <DetailLabel title="Slug">{data.slug}</DetailLabel>
        <DetailLabel title="Status">
          <Tag variant={data.isDraft === true ? 'warning' : 'success'}>
            {data.isDraft === false ? 'published' : 'draft'}
          </Tag>
        </DetailLabel>
        <DetailLabel title="Author">{data.author}</DetailLabel>
        <DetailLabel title="Description">{data.description}</DetailLabel>
        <DetailLabel title="URL">
          <ExternalLink href={data.url}>{data.url}</ExternalLink>
        </DetailLabel>
        <DetailLabel data-test-id="popularity" title="Popularity">
          {data.popularity}
        </DetailLabel>
        <DetailLabel title="Features">
          {data.features?.map((feature: any) => (
            <div key={feature.featureGate}>
              {
                <Tag variant="warning">
                  {feature.featureGate.replace(/(^integrations-)/, '')}
                </Tag>
              }
            </div>
          ))}
        </DetailLabel>
        <DetailLabel title="Resources">
          {data.resources?.map((resource: any) => (
            <div key={resource.title}>
              {resource.title}:{' '}
              <ExternalLink href={resource.url}>{resource.url}</ExternalLink>
            </div>
          ))}
        </DetailLabel>
      </DetailList>
      <DetailList>
        <DocIntegrationAvatar docIntegration={data} size={150} />
      </DetailList>
    </DetailsContainer>
  );

  return (
    <DetailsPage
      rootName="Doc Integrations"
      name={data.name}
      actions={actions}
      sections={[{content: overview}]}
    />
  );
}
