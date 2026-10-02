import {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {ExternalLink} from '@sentry/scraps/link';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ConfigStore} from 'sentry/stores/configStore';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useParams} from 'sentry/utils/useParams';

import {BroadcastEditForm} from 'admin/components/broadcastEditForm';
import {DetailLabel} from 'admin/components/detailLabel';
import {DetailList} from 'admin/components/detailList';
import type {ActionItem, BadgeItem} from 'admin/components/detailsPage';
import {DetailsPage} from 'admin/components/detailsPage';
import type {BroadcastDetailsData} from 'admin/types';
import {
  ALL_PLANCHOICES,
  CATEGORYCHOICES,
  PLATFORMCHOICES,
  PRODUCTCHOICES,
  REGIONCHOICES,
  ROLECHOICES,
  TRIALCHOICES,
} from 'getsentry/utils/broadcasts';

export function BroadcastDetails() {
  const {broadcastId} = useParams<{broadcastId: string}>();
  const broadcastUrl = getApiUrl('/broadcasts/$broadcastId/', {path: {broadcastId}});
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const {data, isPending, isError, refetch} = useQuery(
    apiOptions.as<BroadcastDetailsData>()('/broadcasts/$broadcastId/', {
      path: {broadcastId},
      staleTime: 0,
    })
  );

  const updateMutation = useMutation({
    mutationFn: (params: {isActive: boolean} | {syncLocked: boolean}) =>
      fetchMutation({
        url: broadcastUrl,
        method: 'PUT',
        data: params,
      }),
    onSuccess: () => {
      addSuccessMessage('Broadcast updated.');
      queryClient.invalidateQueries({
        queryKey: [broadcastUrl],
      });
    },
    onError: () => {
      addErrorMessage('There was an internal error updating this broadcast.');
    },
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const isAdmin = ConfigStore.get('user').permissions.has('broadcasts.admin');
  const fromChangelog = Boolean(data.upstreamId);

  const actions: ActionItem[] = [
    {
      key: 'edit-broadcast',
      name: 'Edit Broadcast',
      help: fromChangelog
        ? 'Edit broadcast content. Saving will lock this broadcast from future changelog syncs.'
        : 'Edit broadcast content.',
      visible: isAdmin && !isEditing,
      skipConfirmModal: true,
      onAction: () => setIsEditing(true),
    },
    {
      key: 'toggle-activation',
      name: `${data.isActive ? 'Deactivate' : 'Activate'} Broadcast`,
      help: data.isActive
        ? 'Hide this broadcast from users.'
        : "Show this broadcast to users (if it hasn't expired).",
      visible: isAdmin,
      onAction: () => updateMutation.mutate({isActive: !data.isActive}),
    },
    {
      key: 'unlock-sync',
      name: 'Re-enable changelog sync',
      help: 'Allow the hourly changelog job to refresh this broadcast again. Your manual edits will be overwritten on the next sync.',
      visible: isAdmin && fromChangelog && data.syncLocked && !isEditing,
      onAction: () => updateMutation.mutate({syncLocked: false}),
    },
  ];

  const badges: BadgeItem[] = [
    {
      name: data.isActive ? 'Enabled' : 'Disabled',
      level: data.isActive ? 'success' : 'danger',
    },
  ];
  if (fromChangelog) {
    badges.push({
      name: data.syncLocked ? 'Sync Locked' : 'From Changelog',
      level: data.syncLocked ? 'warning' : 'info',
    });
  }
  if (isEditing) {
    badges.push({name: 'Editing', level: 'warning'});
  }

  return (
    <DetailsPage
      rootName="Broadcasts"
      name={data.title}
      badges={badges}
      actions={actions}
    >
      <DetailsPage.Section>
        {isEditing ? (
          <BroadcastEditForm
            key={broadcastId}
            broadcastId={broadcastId}
            data={data}
            onCancel={() => setIsEditing(false)}
            onSaved={() => setIsEditing(false)}
          />
        ) : (
          <BroadcastOverview data={data} />
        )}
      </DetailsPage.Section>
      <DetailsPage.Section>
        <BroadcastMetadata data={data} />
      </DetailsPage.Section>
    </DetailsPage>
  );
}

function formatData(
  item: string[] | string | null | undefined,
  choices: ReadonlyArray<readonly string[]>
) {
  if (!item || (Array.isArray(item) && item.length === 0)) {
    return '-';
  }
  const values = Array.isArray(item) ? item : [item];
  return values
    .map(value => choices.find(([name]) => name === value)?.[1] ?? value)
    .join(', ');
}

function BroadcastOverview({data}: {data: BroadcastDetailsData}) {
  return (
    <DetailList>
      <DetailLabel title="Title">{data.title}</DetailLabel>
      <DetailLabel title="Message">{data.message}</DetailLabel>
      <DetailLabel title="Link">
        <ExternalLink href={data.link}>{data.link}</ExternalLink>
      </DetailLabel>
      <DetailLabel title="Organization IDs">
        {data.organizations?.length ? data.organizations.join(', ') : '-'}
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
    </DetailList>
  );
}

function BroadcastMetadata({data}: {data: BroadcastDetailsData}) {
  return (
    <DetailList>
      <DetailLabel title="Seen By">
        {data.userCount?.toLocaleString()} user(s)
      </DetailLabel>
      {data.createdBy && <DetailLabel title="Created By">{data.createdBy}</DetailLabel>}
      {data.upstreamId && (
        <DetailLabel title="Changelog ID">{data.upstreamId}</DetailLabel>
      )}
      {data.upstreamId && (
        <DetailLabel title="Sync Status">
          {data.syncLocked ? 'Locked (manual edits)' : 'Auto-synced from changelog'}
        </DetailLabel>
      )}
    </DetailList>
  );
}
