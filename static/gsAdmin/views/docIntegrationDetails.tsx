import {useMutation, useQueryClient, useQuery} from '@tanstack/react-query';

import {DocIntegrationAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {DescriptionList} from '@sentry/scraps/descriptionList';
import {ExternalLink} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import {toast} from '@sentry/scraps/toast';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {DocIntegration} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';

import {DetailLabel} from 'admin/components/detailLabel';
import {DetailsContainer} from 'admin/components/detailsContainer';
import type {ActionItem} from 'admin/components/detailsPage';
import {DetailsPage} from 'admin/components/detailsPage';
import {DocIntegrationModal} from 'admin/components/docIntegrationModal';

export function DocIntegrationDetails() {
  const {openModal} = useModal();

  const {docIntegrationSlug} = useParams<{docIntegrationSlug: string}>();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const ENDPOINT = getApiUrl('/doc-integrations/$docIntegrationIdOrSlug/', {
    path: {docIntegrationIdOrSlug: docIntegrationSlug},
  });

  const queryOptions = apiOptions.as<DocIntegration>()(
    '/doc-integrations/$docIntegrationIdOrSlug/',
    {path: {docIntegrationIdOrSlug: docIntegrationSlug}, staleTime: 0}
  );

  const {data, isPending, isError, refetch} = useQuery(queryOptions);

  const onUpdateMutation = useMutation({
    mutationFn: (params: Record<string, unknown>): Promise<DocIntegration> => {
      return api.requestPromise(ENDPOINT, {
        method: 'PUT',
        data: params,
      });
    },
    onMutate: () => {
      toast.loading('Saving changes...');
    },
    onSuccess: updatedData => {
      toast.success(`Resource has been updated with ${JSON.stringify(updatedData)}.`);
      toast.dismiss();
      queryClient.setQueryData(queryOptions.queryKey, previous =>
        updatedData === undefined
          ? previous
          : {
              ...previous,
              headers: previous?.headers ?? {},
              json: updatedData,
            }
      );
    },
    onError: () => {
      toast.error('There was an internal error with updating the resource.');
      toast.dismiss();
    },
  });

  const onDeleteMutation = useMutation({
    mutationFn: () => {
      return api.requestPromise(ENDPOINT, {
        method: 'DELETE',
      });
    },
    onMutate: () => {
      toast.loading('Deleting doc integration...');
    },
    onSuccess: () => {
      toast.success('Resource has been deleted.');
      navigate('_admin/doc-integrations/');
      toast.dismiss();
    },
    onError: () => {
      toast.error('There was an internal error with deleting the resource.');
      toast.dismiss();
    },
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const publishingAction: ActionItem = data.isDraft
    ? {
        key: 'publish',
        name: 'Publish App',
        help: 'Publishes this Doc Integration',
        skipConfirmModal: true,
        onAction: () =>
          onUpdateMutation.mutate({
            ...data,
            is_draft: false,
            features: data?.features?.map(({featureId}) => featureId),
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
            features: data?.features?.map(({featureId}) => featureId),
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
            queryClient.setQueryData(queryOptions.queryKey, previous => ({
              ...previous,
              headers: previous?.headers ?? {},
              json: docIntegration,
            }));
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
      <DescriptionList gap="md">
        <DetailLabel title="Name">{data.name}</DetailLabel>
        <DetailLabel title="Slug">{data.slug}</DetailLabel>
        <DetailLabel title="Status">
          <Tag variant={data.isDraft ? 'warning' : 'success'}>
            {data.isDraft ? 'draft' : 'published'}
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
          {data.features?.map(feature => (
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
          {data.resources?.map(resource => (
            <div key={resource.title}>
              {resource.title}:{' '}
              <ExternalLink href={resource.url}>{resource.url}</ExternalLink>
            </div>
          ))}
        </DetailLabel>
      </DescriptionList>
      <DescriptionList gap="md">
        <DocIntegrationAvatar docIntegration={data} size={150} />
      </DescriptionList>
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
