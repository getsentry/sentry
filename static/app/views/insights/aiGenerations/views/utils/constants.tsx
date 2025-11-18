import {getAIGenerationsFilter} from 'sentry/views/insights/pages/agents/utils/query';
import type {SpanFields} from 'sentry/views/insights/types';

export const GENERATIONS_COUNT_FIELD = 'span.duration';
// Only show generation spans that result in a response to the user's message
export const AI_GENERATIONS_PAGE_FILTER = `${getAIGenerationsFilter()}  AND !span.op:gen_ai.embeddings AND (has:gen_ai.response.text OR has:gen_ai.response.object)`;

export const INPUT_OUTPUT_FIELD = 'Input / Output' as const;

export type GenerationFields = typeof INPUT_OUTPUT_FIELD | SpanFields;
