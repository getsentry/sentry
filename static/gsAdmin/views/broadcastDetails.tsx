import {useState} from 'react';
import moment from 'moment-timezone';

import {Alert} from '@sentry/scraps/alert';
import {ExternalLink} from '@sentry/scraps/link';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {ApiForm} from 'sentry/components/forms/apiForm';
import {BooleanField} from 'sentry/components/forms/fields/booleanField';
import {DateTimeField} from 'sentry/components/forms/fields/dateTimeField';
import {SelectField} from 'sentry/components/forms/fields/selectField';
import {TextField} from 'sentry/components/forms/fields/textField';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ConfigStore} from 'sentry/stores/configStore';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useParams} from 'sentry/utils/useParams';

import {DetailLabel} from 'admin/components/detailLabel';
import {DetailList} from 'admin/components/detailList';
import type {ActionItem, BadgeItem} from 'admin/components/detailsPage';
import {DetailsPage} from 'admin/components/detailsPage';
import {
  ALL_PLANCHOICES,
  CATEGORYCHOICES,
  PLATFORMCHOICES,
  PRODUCTCHOICES,
  REGIONCHOICES,
  ROLECHOICES,
  TRIALCHOICES,
} from 'getsentry/utils/broadcasts';

const fieldProps = {
  stacked: true,
  inline: false,
  flexibleControlStateSize: true,
} as const;

// Fields the backend accepts as null to clear the stored value.
// Mirror `allow_null=True` in AdminBroadcastValidator.
const NULLABLE_FIELDS = new Set(['dateExpires']);

export function BroadcastDetails() {
  const {broadcastId} = useParams<{broadcastId: string}>();
  const api = useApi();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const {data, isPending, isError, refetch} = useApiQuery<any>(
    [
      getApiUrl('/broadcasts/$broadcastId/', {
        path: {broadcastId},
      }),
    ],
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

  const isAdmin = ConfigStore.get('user').permissions.has('broadcasts.admin');
  const fromChangelog = Boolean(data.upstreamId);

  const onUpdate = async (params: Record<string, any>) => {
    addLoadingMessage('Saving Changes...');
    try {
      const response = await api.requestPromise(`/broadcasts/${broadcastId}/`, {
        method: 'PUT',
        data: params,
      });
      clearIndicators();
      addSuccessMessage('Broadcast updated.');
      setApiQueryData<Record<string, unknown>>(
        queryClient,
        [
          getApiUrl('/broadcasts/$broadcastId/', {
            path: {broadcastId},
          }),
        ],
        prevData => ({
          ...prevData,
          ...response,
        })
      );
    } catch {
      clearIndicators();
      addErrorMessage('There was an internal error updating this broadcast.');
    }
  };

  const toOptions = (choices: ReadonlyArray<readonly string[]>) =>
    choices.map(c => ({value: c[0]!, label: c[1]!}));

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
    </DetailList>
  );

  const editSection = (
    <ApiForm
      apiMethod="PUT"
      apiEndpoint={`/broadcasts/${broadcastId}/`}
      onSubmit={(formData: Record<string, any>) => {
        const payload: Record<string, any> = {};
        for (const [key, value] of Object.entries(formData)) {
          if (value === '' || value === undefined) {
            continue;
          }
          if (value === null && !NULLABLE_FIELDS.has(key)) {
            continue;
          }
          payload[key] = value;
        }
        return payload;
      }}
      onSubmitSuccess={() => {
        addSuccessMessage('Broadcast updated.');
        refetch();
        setIsEditing(false);
      }}
      onSubmitError={error => {
        const detail =
          error?.responseJSON?.detail ||
          JSON.stringify(error?.responseJSON) ||
          'Unknown error';
        addErrorMessage(`Save failed: ${detail}`);
      }}
      onCancel={() => setIsEditing(false)}
      submitLabel="Save Changes"
      cancelLabel="Cancel"
      initialData={{
        title: data.title,
        message: data.message,
        link: data.link,
        mediaUrl: data.mediaUrl ?? undefined,
        category: data.category ?? undefined,
        isActive: data.isActive,
        dateExpires: data.dateExpires ?? null,
        roles: data.roles ?? [],
        plans: data.plans ?? [],
        trialStatus: data.trialStatus ?? undefined,
        earlyAdopter: Boolean(data.earlyAdopter),
        region: data.region ?? [],
        platform: data.platform ?? [],
        product: data.product ?? [],
      }}
    >
      {fromChangelog && !data.syncLocked && (
        <Alert.Container>
          <Alert variant="info">
            This broadcast was created from the changelog. Saving edits will lock it from
            future hourly syncs.
          </Alert>
        </Alert.Container>
      )}
      {fromChangelog && data.syncLocked && (
        <Alert.Container>
          <Alert variant="warning">
            Changelog sync is locked for this broadcast. Use “Re-enable changelog sync” to
            let the hourly job refresh it again.
          </Alert>
        </Alert.Container>
      )}

      <TextField {...fieldProps} name="title" label="Title" required maxLength={64} />
      <TextField
        {...fieldProps}
        name="message"
        label="Message"
        required
        maxLength={256}
      />
      <TextField {...fieldProps} name="link" label="Link" required />
      <TextField
        {...fieldProps}
        name="mediaUrl"
        label="Media URL"
        help="Optional. Image or video shown in What's New."
      />
      <SelectField
        {...fieldProps}
        name="category"
        label="Category"
        options={toOptions(CATEGORYCHOICES)}
      />
      <DateTimeField {...fieldProps} name="dateExpires" label="Expires" />
      <BooleanField {...fieldProps} name="isActive" label="Active" />

      <SelectField
        {...fieldProps}
        name="roles"
        label="Roles"
        multiple
        options={toOptions(ROLECHOICES)}
      />
      <SelectField
        {...fieldProps}
        name="plans"
        label="Plans"
        multiple
        options={toOptions(ALL_PLANCHOICES)}
      />
      <SelectField
        {...fieldProps}
        name="trialStatus"
        label="Trial Status"
        options={toOptions(TRIALCHOICES)}
      />
      <BooleanField {...fieldProps} name="earlyAdopter" label="Early Adopter" />
      <SelectField
        {...fieldProps}
        name="region"
        label="Region"
        multiple
        options={toOptions(REGIONCHOICES)}
      />
      <SelectField
        {...fieldProps}
        name="platform"
        label="Platform"
        multiple
        options={toOptions(PLATFORMCHOICES)}
      />
      <SelectField
        {...fieldProps}
        name="product"
        label="Product"
        multiple
        options={toOptions(PRODUCTCHOICES)}
      />
    </ApiForm>
  );

  const metadataSection = (
    <DetailList>
      <DetailLabel title="Seen By">
        {data.userCount?.toLocaleString()} user(s)
      </DetailLabel>
      {data.createdBy && <DetailLabel title="Created By">{data.createdBy}</DetailLabel>}
      {data.upstreamId && (
        <DetailLabel title="Changelog ID">{data.upstreamId}</DetailLabel>
      )}
      {fromChangelog && (
        <DetailLabel title="Sync Status">
          {data.syncLocked ? 'Locked (manual edits)' : 'Auto-synced from changelog'}
        </DetailLabel>
      )}
    </DetailList>
  );

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
      onAction: () => onUpdate({isActive: !data.isActive}),
    },
    {
      key: 'unlock-sync',
      name: 'Re-enable changelog sync',
      help: 'Allow the hourly changelog job to refresh this broadcast again. Your manual edits will be overwritten on the next sync.',
      visible: isAdmin && fromChangelog && data.syncLocked && !isEditing,
      onAction: () => onUpdate({syncLocked: false}),
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
      sections={
        isEditing
          ? [{content: editSection}, {content: metadataSection}]
          : [{content: overviewSection}, {content: metadataSection}]
      }
    />
  );
}
