import type {Sort} from 'sentry/utils/discover/fields';
import {
  useEAPSpans,
  useSpansIndexed,
} from 'sentry/views/insights/common/queries/useDiscover';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import {SpanFields, SpanIndexedField} from 'sentry/views/insights/types';

type Options = {
  referrer: string;
  enabled?: boolean;
  limit?: number;
  queryConditions?: string[];
  sorts?: Sort[];
};

export const useIndexedResourcesQuery = ({
  queryConditions = [],
  limit = 50,
  sorts,
  referrer,
  enabled = true,
}: Options) => {
  const useEap = useInsightsEap();

  const eapResult = useEAPSpans(
    {
      fields: [
        SpanFields.PROJECT,
        SpanFields.SPAN_GROUP,
        SpanFields.RAW_DOMAIN,
        SpanFields.SPAN_DESCRIPTION,
        SpanFields.MEASUREMENT_HTTP_RESPONSE_CONTENT_LENGTH,
      ],
      limit,
      sorts,
      search: queryConditions.join(' '),
      enabled: enabled && useEap,
    },
    referrer
  );

  const spanIndexedResult = useSpansIndexed(
    {
      fields: [
        'any(id)',
        SpanIndexedField.PROJECT,
        SpanIndexedField.SPAN_GROUP,
        SpanIndexedField.RAW_DOMAIN,
        SpanIndexedField.SPAN_DESCRIPTION,
        SpanIndexedField.MEASUREMENT_HTTP_RESPONSE_CONTENT_LENGTH,
      ],
      limit,
      sorts,
      search: queryConditions.join(' '),
      enabled: enabled && !useEap,
    },
    referrer
  );

  return useEap ? eapResult : spanIndexedResult;
};
