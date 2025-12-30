import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {SentryAppAvatar} from 'sentry/components/core/avatar/sentryAppAvatar';
import {Tag} from 'sentry/components/core/badge/tag';
import {Link} from 'sentry/components/core/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useParams} from 'sentry/utils/useParams';

import DetailLabel from 'admin/components/detailLabel';
import DetailList from 'admin/components/detailList';
import DetailsContainer from 'admin/components/detailsContainer';
import type {ActionItem} from 'admin/components/detailsPage';
import DetailsPage from 'admin/components/detailsPage';
import SentryAppUpdateModal from 'admin/components/sentryAppUpdateModal';

export default function SentryAppDetails() {
  const {sentryAppSlug} = useParams<{sentryAppSlug: string}>();
  const ENDPOINT = `/sentry-apps/${sentryAppSlug}/`;
  const api = useApi();
  const queryClient = useQueryClient();

  const {data, isPending, isError, refetch} = useApiQuery<any>([ENDPOINT], {
    staleTime: 0,
  });

  const onUpdateMutation = useMutation({
    mutationFn: (updatedData: Record<string, any>) => {
      return api.requestPromise(ENDPOINT, {
        method: 'PUT',
        data: updatedData,
      });
    },
    onMutate: () => {
      addLoadingMessage('Saving Changes...');
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

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  let publishingAction: ActionItem | undefined;
  switch (data.status) {
    case 'unpublished':
    case 'publish_request_inprogress':
      publishingAction = {
        key: 'publish',
        name: 'Publish App',
        help: 'Publishes this Sentry App',
        onAction: () => onUpdateMutation.mutate({status: 'published'}),
      };
      break;
    case 'published':
      publishingAction = {
        key: 'unpublish',
        name: 'Unpublish App',
        help: 'Unpublishes this Sentry App',
        onAction: () => onUpdateMutation.mutate({status: 'unpublished'}),
      };
      break;
    case 'internal':
    default:
      publishingAction = undefined;
  }

  const updateDetailsAction = {
    key: 'update-details',
    name: 'Update Details',
    help: 'Update the details of this Sentry App (e.g. popularity)',
    skipConfirmModal: true,
    onAction: () =>
      openModal(deps => (
        <SentryAppUpdateModal
          {...deps}
          sentryAppData={data}
          onAction={onUpdateMutation.mutate}
        />
      )),
  };

  const actions =
    publishingAction === undefined
      ? [updateDetailsAction]
      : [updateDetailsAction, publishingAction];

  const overview = (
    <DetailsContainer>
      <DetailList>
        <DetailLabel title="Name">{data.name}</DetailLabel>
        <DetailLabel title="Slug">{data.slug}</DetailLabel>
        <DetailLabel title="Status">{data.status}</DetailLabel>
        <DetailLabel title="Owner">
          <Link to={`/_admin/customers/${data.owner.slug}/`}>{data.owner.slug}</Link>
        </DetailLabel>
        <DetailLabel title="isAlertable" yesNo={data.isAlertable} />
        <DetailLabel title="Popularity">{data.popularity}</DetailLabel>
        <DetailLabel title="Scopes">
          {data.scopes.map((scope: any) => (
            <div key={scope}>
              <code>{scope}</code>
            </div>
          ))}
        </DetailLabel>
        <DetailLabel title="Features">
          {data.featureData?.map((feature: any) => (
            <div key={feature.featureGate}>
              {
                <Tag variant="warning">
                  {feature.featureGate.replace(/(^integrations-)/, '')}
                </Tag>
              }
            </div>
          ))}
        </DetailLabel>
      </DetailList>
      <DetailList>
        <DetailLabel title="Directory Logo" />
        <SentryAppAvatar sentryApp={data} size={100} />
        <br />
        <DetailLabel title="UI Component Icon" />
        <SentryAppAvatar sentryApp={data} size={30} isColor={false} />
      </DetailList>
    </DetailsContainer>
  );

  return (
    <DetailsPage
      rootName="Sentry Apps"
      name={data.name}
      badges={[
        {
          name: data.status,
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          level: {unpublished: 'error', internal: 'warning'}[data.status] ?? 'success',
        },
      ]}
      actions={actions}
      sections={[{content: overview}]}
    />
  );
}
