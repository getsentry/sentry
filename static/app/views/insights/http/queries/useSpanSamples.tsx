// TODO: This is a _more general_ version of `useSpanSamples` from `/starfish/queries`. That hook should rely on this one _or_ they should be consolidated.

import {defined} from 'sentry/utils';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {
  DefaultSpanSampleFields,
  NonDefaultSpanSampleFields,
} from 'sentry/views/insights/common/queries/useSpanSamples';
import {getDateConditions} from 'sentry/views/insights/common/utils/getDateConditions';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import {SpanIndexedField, type SpanIndexedResponse} from 'sentry/views/insights/types';

interface UseSpanSamplesOptions<Fields> {
  enabled?: boolean;
  fields?: Fields;
  max?: number;
  min?: number;
  referrer?: string;
  search?: MutableSearch;
}

export const useSpanSamples = <Fields extends NonDefaultSpanSampleFields[]>(
  options: UseSpanSamplesOptions<Fields> = {}
) => {
  const {
    fields = [],
    search = undefined,
    referrer,
    enabled,
    min = undefined,
    max = undefined,
  } = options;

  const useEap = useInsightsEap();
  const {selection} = usePageFilters();
  const organization = useOrganization();

  if (defined(min) && min < 0) {
    throw new Error('Minimum must be greater than 0');
  }

  if (defined(min) && defined(max) && min >= max) {
    throw new Error('Maximum must be higher than minimum');
  }

  const dateConditions = getDateConditions(selection);

  return useApiQuery<{
    data: Array<Pick<SpanIndexedResponse, Fields[number] | DefaultSpanSampleFields>>;
    meta: EventsMetaType;
  }>(
    [
      `/api/0/organizations/${organization.slug}/spans-samples/`,
      {
        query: {
          query: search?.formatString(),
          project: selection.projects,
          ...dateConditions,
          ...{utc: selection.datetime.utc},
          environment: selection.environments,
          lowerBound: min,
          firstBound: max && max * (1 / 3),
          secondBound: max && max * (2 / 3),
          upperBound: max,
          // TODO: transaction.span_id should be a default from the backend
          additionalFields: [...fields, SpanIndexedField.TRANSACTION_SPAN_ID],
          sort: '-timestamp',
          sampling: useEap ? SAMPLING_MODE.NORMAL : undefined,
          dataset: useEap ? DiscoverDatasets.SPANS_EAP : undefined,
          referrer,
        },
      },
    ],
    {
      enabled,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    }
  );
};
