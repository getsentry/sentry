import moment from 'moment-timezone';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {ExternalLink} from 'sentry/components/core/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import ConfigStore from 'sentry/stores/configStore';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useParams} from 'sentry/utils/useParams';

import DetailLabel from 'admin/components/detailLabel';
import DetailList from 'admin/components/detailList';
import DetailsPage from 'admin/components/detailsPage';
import {
  ALL_PLANCHOICES,
  CATEGORYCHOICES,
  PLATFORMCHOICES,
  PRODUCTCHOICES,
  REGIONCHOICES,
  ROLECHOICES,
  TRIALCHOICES,
} from 'getsentry/utils/broadcasts';

export default function BroadcastDetails() {
  const {broadcastId} = useParams<{broadcastId: string}>();
  const api = useApi();
  const queryClient = useQueryClient();

  const {data, isPending, isError, refetch} = useApiQuery<any>(
    [`/broadcasts/${broadcastId}/`],
    {
      staleTime: 0,
    }
  );

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const onUpdate = async (params: Record<string, any>) => {
    addLoadingMessage('Saving Changes...');
    try {
      const response = await api.requestPromise(`/broadcasts/${broadcastId}/`, {
        method: 'PUT',
        data: params,
      });
      clearIndicators();
      addSuccessMessage(
        `Customer account has been updated with ${JSON.stringify(params)}.`
      );
      setApiQueryData<Record<string, unknown>>(
        queryClient,
        [`/broadcasts/${broadcastId}/`],
        prevData => ({
          ...prevData,
          ...response,
        })
      );
    } catch {
      clearIndicators();
      addErrorMessage('There was an internal error with updating the customer account.');
    }
  };

  const formatData = (item: string[] | string, choices: any) => {
    if (Array.isArray(item)) {
      if (item.length === 0) {
        return '-';
      }
      return item
        .map(value => choices.find(([name, _]: any) => name === value))
        .map(([_, label]) => label)
        .join(', ');
    }

    return item ? (choices.find(([name, _]: any) => name === item)?.[1] ?? '-') : '-';
  };

  const overviewSection = (
    <DetailList>
      <DetailLabel title="Title">{data.title}</DetailLabel>

      <DetailLabel title="Message">{data.message}</DetailLabel>

      <DetailLabel title="Link">
        <ExternalLink href={data.link}>{data.link}</ExternalLink>
      </DetailLabel>

      <DetailLabel title="Media URL">{data.mediaUrl ?? '-'}</DetailLabel>

      <DetailLabel title="Category">
        {formatData(data.category, CATEGORYCHOICES)}
      </DetailLabel>

      <DetailLabel title="Roles">{formatData(data.roles, ROLECHOICES)}</DetailLabel>

      <DetailLabel title="Plans">{formatData(data.plans, ALL_PLANCHOICES)}</DetailLabel>

      <DetailLabel title="Trial Status">
        {formatData(data.trialStatus, TRIALCHOICES)}
      </DetailLabel>

      <DetailLabel title="Early Adopter">{data.earlyAdopter ? 'Yes' : '-'}</DetailLabel>

      <DetailLabel title="Region">{formatData(data.region, REGIONCHOICES)}</DetailLabel>

      <DetailLabel title="Platform">
        {formatData(data.platform, PLATFORMCHOICES)}
      </DetailLabel>

      <DetailLabel title="Product">
        {formatData(data.product, PRODUCTCHOICES)}
      </DetailLabel>

      <DetailLabel title="Expires">
        {data.dateExpires ? moment(data.dateExpires).fromNow() : '∞'}
      </DetailLabel>

      <DetailLabel title="Status">{data.isActive ? 'Active' : 'Inactive'}</DetailLabel>

      <DetailLabel title="Seen By">
        {data.userCount?.toLocaleString()} user(s)
      </DetailLabel>

      {data.createdBy && <DetailLabel title="Created By">{data.createdBy}</DetailLabel>}
    </DetailList>
  );

  return (
    <DetailsPage
      rootName="Broadcasts"
      name={data.title}
      badges={[
        {
          name: data.isActive ? 'Enabled' : 'Disabled',
          level: data.isActive ? 'success' : 'danger',
        },
      ]}
      actions={[
        {
          key: 'toggle-activation',
          name: `${data.isActive ? 'Deactive' : 'Activate'} Broadcast`,
          help: data.isActive
            ? 'Hide this broadcast form users.'
            : "Show this broadcast to users (if it hasn't expired).",
          visible: ConfigStore.get('user').permissions.has('broadcasts.admin'),
          onAction: () => onUpdate({isActive: !data.isActive}),
        },
      ]}
      sections={[{content: overviewSection}]}
    />
  );
}
