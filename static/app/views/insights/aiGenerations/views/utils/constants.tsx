import {getAIGenerationsFilter} from 'sentry/views/insights/agents/utils/query';

export const GENERATIONS_COUNT_FIELD = 'span.duration';
// Only show generation spans that result in a response to the user's message
export const AI_GENERATIONS_PAGE_FILTER = `${getAIGenerationsFilter()}  AND !span.op:gen_ai.embeddings AND (has:gen_ai.response.text OR has:gen_ai.response.object)`;
