import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';
import {
  CLASSIFIER_DETAIL_STATS_PERIOD,
  getResultAttributeKey,
} from 'sentry/views/classifiers/utils';

const CONVERSATION_COUNT_FIELD = 'count_unique(gen_ai.conversation.id)';

export function useClassifiedConversationCount(classifier: TelemetryClassifier) {
  const organization = useOrganization();
  const resultField = `tags[${getResultAttributeKey(classifier.resultAttribute)},number]`;

  return useQuery({
    ...apiOptions.as<{data: Array<Record<string, number | null | undefined>>}>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: DiscoverDatasets.ENRICHMENT_ATTRIBUTES,
          field: [CONVERSATION_COUNT_FIELD],
          query: `has:${resultField}`,
          project: [Number(classifier.projectId)],
          statsPeriod: CLASSIFIER_DETAIL_STATS_PERIOD,
          referrer: 'api.classifiers.detail.conversation-count',
        },
        staleTime: 60_000,
      }
    ),
    select: response => response.json.data[0]?.[CONVERSATION_COUNT_FIELD] ?? 0,
  });
}
