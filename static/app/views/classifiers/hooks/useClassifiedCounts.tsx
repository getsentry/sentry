import {useQuery} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';

import {useClassifierOutput} from './useClassifierOutput';
import {useClassifierPageFilters} from './useClassifierPageFilters';

const CONVERSATION_COUNT_FIELD = 'count_unique(gen_ai.conversation.id)';
const USER_COUNT_FIELD = 'count_unique(user)';

export function useClassifiedCounts(classifier: TelemetryClassifier) {
  const organization = useOrganization();
  const selection = useClassifierPageFilters(classifier);
  const {resultQuery} = useClassifierOutput(classifier);

  return useQuery({
    ...apiOptions.as<{data: Array<Record<string, number | null | undefined>>}>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: DiscoverDatasets.ENRICHMENT_ATTRIBUTES,
          field: [CONVERSATION_COUNT_FIELD, USER_COUNT_FIELD],
          query: resultQuery,
          project: [Number(classifier.projectId)],
          environment: selection.environments,
          ...normalizeDateTimeParams(selection.datetime),
          referrer: 'api.classifiers.detail.conversation-count',
        },
        staleTime: 60_000,
      }
    ),
    select: response => {
      const row = response.json.data[0];
      return {
        conversations: row?.[CONVERSATION_COUNT_FIELD] ?? 0,
        users: row?.[USER_COUNT_FIELD] ?? 0,
      };
    },
  });
}
