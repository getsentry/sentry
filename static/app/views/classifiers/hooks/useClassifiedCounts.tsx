import {useQuery} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';
import {getClassifierResultQuery} from 'sentry/views/classifiers/utils';

import {useClassifierPageFilters} from './useClassifierPageFilters';
import {useClassifierResultFilter} from './useClassifierResultFilter';

const CONVERSATION_COUNT_FIELD = 'count_unique(gen_ai.conversation.id)';
const USER_COUNT_FIELD = 'count_unique(user)';

export function useClassifiedCounts(classifier: TelemetryClassifier) {
  const organization = useOrganization();
  const selection = useClassifierPageFilters(classifier);
  const {resultFilter} = useClassifierResultFilter(classifier);

  return useQuery({
    ...apiOptions.as<{data: Array<Record<string, number | null | undefined>>}>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: DiscoverDatasets.ENRICHMENT_ATTRIBUTES,
          field: [CONVERSATION_COUNT_FIELD, USER_COUNT_FIELD],
          query: getClassifierResultQuery(classifier, resultFilter),
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
