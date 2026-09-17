import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AlwaysPresentLogFields} from 'sentry/views/explore/logs/constants';
import {
  OurLogKnownFieldKey,
  type EventsLogsResult,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {getLogRowTimestampMillis} from 'sentry/views/explore/logs/utils';

import {EmbedStory, EmbedVariant} from './embedStory';

const STORY_REFERRER = 'seer-log-embed-story';

/**
 * Every log carries a severity, so the breakdown variant always has something
 * to group by whichever row this organization happens to supply.
 */
const BREAKDOWN_ATTRIBUTE = OurLogKnownFieldKey.SEVERITY;

function toIdentity(log: OurLogsResponseItem) {
  const timestampMs = getLogRowTimestampMillis(log);

  return {
    id: String(log[OurLogKnownFieldKey.ID]),
    traceId: String(log[OurLogKnownFieldKey.TRACE_ID]),
    projectId: String(log[OurLogKnownFieldKey.PROJECT_ID]),
    timestamp: Number.isFinite(timestampMs)
      ? new Date(timestampMs).toISOString()
      : String(log[OurLogKnownFieldKey.TIMESTAMP]),
  };
}

export function LogEmbedStory() {
  const organization = useOrganization();
  const {data, isError, isPending} = useQuery(
    apiOptions.as<EventsLogsResult>()('/organizations/$organizationIdOrSlug/events/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        dataset: DiscoverDatasets.OURLOGS,
        field: AlwaysPresentLogFields,
        project: [ALL_ACCESS_PROJECTS],
        sort: `-${OurLogKnownFieldKey.TIMESTAMP}`,
        statsPeriod: '7d',
        per_page: 25,
        referrer: STORY_REFERRER,
      },
      // Keep every variant on the page pointed at the same row while it is read.
      staleTime: Infinity,
    })
  );

  // The details lookup behind the block is addressed by trace and project, so
  // prefer a row that already carries both over one the block has to resolve.
  const log = data?.data.find(
    row => row[OurLogKnownFieldKey.TRACE_ID] && row[OurLogKnownFieldKey.PROJECT_ID]
  );
  const identity = log ? toIdentity(log) : null;

  return (
    <EmbedStory name="log">
      {isPending ? (
        <LoadingIndicator />
      ) : isError ? (
        <Text variant="muted">Unable to load a log example.</Text>
      ) : identity ? (
        <Fragment>
          <EmbedVariant name="log" label="Log" data={identity} />
          <EmbedVariant
            name="log"
            label="All attributes"
            data={{...identity, view: 'attributes'}}
          />
          <EmbedVariant
            name="log"
            label="Single attribute breakdown"
            data={{...identity, view: 'attribute', attribute: BREAKDOWN_ATTRIBUTE}}
          />
          <EmbedVariant
            name="log"
            label="Id only (the embed resolves trace and project)"
            data={{id: identity.id}}
          />
        </Fragment>
      ) : (
        <Text variant="muted">No log is available for this organization.</Text>
      )}
    </EmbedStory>
  );
}
