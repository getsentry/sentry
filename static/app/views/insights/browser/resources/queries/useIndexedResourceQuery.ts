import type {Sort} from 'sentry/utils/discover/fields';
import {useSpansIndexed} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanIndexedField} from 'sentry/views/insights/types';

type Options = {
  enabled?: boolean;
  limit?: number;
  queryConditions?: string[];
  referrer?: string;
  sorts?: Sort[];
};

export const useIndexedResourcesQuery = ({
  queryConditions = [],
  limit = 50,
  sorts,
  referrer,
  enabled = true,
}: Options) => {
  return useSpansIndexed(
    {
      fields: [
        `any(id)`,
        SpanIndexedField.PROJECT,
        SpanIndexedField.SPAN_GROUP,
        SpanIndexedField.RAW_DOMAIN,
        SpanIndexedField.SPAN_DESCRIPTION,
        SpanIndexedField.MEASUREMENT_HTTP_RESPONSE_CONTENT_LENGTH,
      ],
      limit,
      sorts,
      query: queryConditions.join(' '),
      enabled,
    },
    referrer
  );
};
