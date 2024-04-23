// TODO: This is a _more general_ version of `useSpanSamples` from `/starfish/queries`. That hook should rely on this one _or_ they should be consolidated.

import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {
  IndexedProperty,
  IndexedResponse,
  SpanIndexedField,
} from 'sentry/views/starfish/types';
import {getDateConditions} from 'sentry/views/starfish/utils/getDateConditions';

interface UseSpanSamplesOptions<Fields> {
  enabled?: boolean;
  fields?: Fields;
  max?: number;
  min?: number;
  referrer?: string;
  search?: MutableSearch;
}

export const useSpanSamples = <Fields extends IndexedProperty[]>(
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

  const {selection} = usePageFilters();

  const organization = useOrganization();

  if (defined(min) && min < 0) {
    throw new Error('Minimum must be greater than 0');
  }

  if (defined(min) && defined(max) && min >= max) {
    throw new Error('Maximum must be higher than minimum');
  }

  const dateConditions = getDateConditions(selection);

  const result = useApiQuery<{
    data:
      | Pick<
          IndexedResponse,
          | Fields[number]
          // These fields are returned by default
          | SpanIndexedField.PROJECT
          | SpanIndexedField.TRANSACTION_ID
          | SpanIndexedField.TIMESTAMP
          | SpanIndexedField.ID
          | SpanIndexedField.PROFILE_ID
        >[]
      // This type is a little awkward but it explicitly states that the response could be empty. This doesn't enable unchecked access errors, but it at least indicates that it's possible that there's no data
      // eslint-disable-next-line @typescript-eslint/ban-types
      | [];
    meta: 'hello';
  }>(
    [
      `/api/0/organizations/${organization.slug}/spans-samples/`,
      {
        query: {
          query: search?.formatString(),
          project: selection.projects,
          ...dateConditions,
          ...{utc: selection.datetime.utc},
          lowerBound: min,
          firstBound: max && max * (1 / 3),
          secondBound: max && max * (2 / 3),
          upperBound: max,
          additionalFields: fields,
          referrer,
        },
      },
    ],
    {
      enabled,
      staleTime: Infinity,
      retry: false,
    }
  );

  return {
    ...result,
    data: result.data?.data ?? [],
  };
};
