import {parseAsArrayOf, parseAsStringEnum, useQueryState} from 'nuqs';

import {
  INPUT_OUTPUT_FIELD,
  type GenerationFields,
} from 'sentry/views/insights/aiGenerations/views/utils/constants';
import {SpanFields} from 'sentry/views/insights/types';

const defaultFields: GenerationFields[] = [
  SpanFields.ID,
  INPUT_OUTPUT_FIELD,
  SpanFields.GEN_AI_REQUEST_MODEL,
  SpanFields.TIMESTAMP,
];

export function useFieldsQueryParam() {
  return useQueryState(
    'fields',
    parseAsArrayOf(
      parseAsStringEnum([...Object.values(SpanFields), INPUT_OUTPUT_FIELD])
    ).withDefault(defaultFields)
  );
}
