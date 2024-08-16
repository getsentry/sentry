import ErrorBoundary from 'sentry/components/errorBoundary';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {t} from 'sentry/locale';
import {type Event, type ReplayContext, ReplayContextKey} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';

import {
  getContextMeta,
  getKnownData,
  getKnownStructuredData,
  getUnknownData,
  type KnownDataDetails,
} from '../utils';

const REPLAY_KNOWN_DATA_VALUES = ['replay_id'];

interface ReplayContextProps {
  data: ReplayContext & Record<string, any>;
  event: Event;
  meta?: Record<string, any>;
}

export function getKnownReplayContextData({
  data,
  meta,
  organization,
}: Pick<ReplayContextProps, 'data' | 'meta'> & {
  organization: Organization;
}) {
  return getKnownData<ReplayContext, ReplayContextKey>({
    data,
    meta,
    knownDataTypes: REPLAY_KNOWN_DATA_VALUES,
    onGetKnownDataDetails: v => getReplayKnownDataDetails({...v, organization}),
  }).map(v => ({
    ...v,
    subjectDataTestId: `replay-context-${v.key.toLowerCase()}-value`,
  }));
}

export function getUnknownReplayContextData({
  data,
  meta,
}: Pick<ReplayContextProps, 'data' | 'meta'>) {
  return getUnknownData({
    allData: data,
    knownKeys: REPLAY_KNOWN_DATA_VALUES,
    meta,
  });
}

export function ReplayEventContext({event, data, meta: propsMeta}: ReplayContextProps) {
  const organization = useOrganization();
  const meta = propsMeta ?? getContextMeta(event, 'replay');

  const knownData = getKnownReplayContextData({data, meta, organization});
  const knownStructuredData = getKnownStructuredData(knownData, meta);
  const unknownData = getUnknownReplayContextData({data, meta});

  return (
    <ErrorBoundary mini>
      <KeyValueList
        data={knownStructuredData}
        shouldSort={false}
        raw={false}
        isContextData
      />
      <KeyValueList data={unknownData} shouldSort={false} raw={false} isContextData />
    </ErrorBoundary>
  );
}

function getReplayKnownDataDetails({
  data,
  organization,
  type,
}: {
  data: ReplayContext;
  organization: Organization;
  type: ReplayContextKey;
  project?: Project;
}): KnownDataDetails {
  switch (type) {
    case ReplayContextKey.REPLAY_ID: {
      const replayId = data.replay_id || '';
      if (!replayId) {
        return undefined;
      }
      const link = `/organizations/${organization.slug}/replays/${encodeURIComponent(replayId)}/`;
      return {
        subject: t('Replay ID'),
        value: replayId,
        action: {link},
      };
    }
    default:
      return undefined;
  }
}
