import {t} from 'sentry/locale';
import type {Event, ExceptionValue} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {getGenAiOpType} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

/**
 * Where in the agent run the error was raised, from the closest AI span above it.
 */
type FailureLocation = 'agent' | 'model_call' | 'tool' | 'other';

interface FailureSignals {
  exceptionType: string;
  exceptionValue: string;
  handled: boolean;
  location: FailureLocation;
  /**
   * The error was raised directly in the agent span, not in a span below it.
   */
  raisedInRunSpan: boolean;
}

const RUN_LIMIT =
  /SoftTimeLimit|TimeLimitExceeded|MaxTurns|MaxIterations|RecursionLimit|max_turns|step limit|turn limit/i;
const TIMEOUT_TYPE = /Timeout|TimeLimit|TimedOut|DeadlineExceeded/i;
const TIMEOUT_TEXT = /timed? ?out|time limit|deadline exceeded/i;
const CONNECTION_TEXT =
  /connection (reset|refused|closed|aborted|error)|response ended prematurely|ChunkedEncodingError|RemoteDisconnected|ConnectError|ECONNRESET|socket hang up/i;
const MODEL_OUTPUT_TEXT =
  /structured output|OutputParser|failed to parse (model|llm)|invalid tool call/i;
// A status code is followed by its reason phrase, as in `503 Service Unavailable`.
const STATUS_TEXT =
  /(?:\bstatus(?:_code)?\W{0,3}|\bHTTP\W{0,2}|^|\s)([45]\d\d)\b(?=\s*(?:[A-Z][a-z]|for\b|[:",]|$))/;
// Agent runtimes wrap the error raised by model-written code, as in
// `MontyRuntimeError: ValueError: ...`.
const WRAPPED_TYPE = /^([A-Za-z_]+(?:Error|Exception)):/;
const PROVIDER_TYPES = new Set([
  'ProviderError',
  'RateLimitError',
  'APIStatusError',
  'OverloadedError',
]);

// Only the start of a message carries the status and error type, and long
// messages make the regexes slow.
const MESSAGE_PREFIX_LENGTH = 400;

function getHttpStatus(exceptionValue: string): number | null {
  const match = STATUS_TEXT.exec(exceptionValue.slice(0, MESSAGE_PREFIX_LENGTH));
  return match?.[1] ? Number(match[1]) : null;
}

/**
 * Names the broad kind of failure from where it happened and what the error says.
 * Returns `null` when no rule matches, so that no label is better than a wrong one.
 * Rules are checked in order and the first match wins.
 */
export function getFailureKind({
  location,
  exceptionType,
  exceptionValue,
  handled,
  raisedInRunSpan,
}: FailureSignals): string | null {
  const value = exceptionValue.slice(0, MESSAGE_PREFIX_LENGTH);
  const text = `${exceptionType}: ${value}`;
  const shortType =
    WRAPPED_TYPE.exec(value)?.[1] ?? exceptionType.split('.').at(-1) ?? exceptionType;
  const status = getHttpStatus(value);

  if (RUN_LIMIT.test(text)) {
    return t('Hit a time limit');
  }
  if (
    location === 'model_call' ||
    PROVIDER_TYPES.has(shortType) ||
    value.includes('AI provider error')
  ) {
    return t('The model provider failed');
  }
  if (MODEL_OUTPUT_TEXT.test(text)) {
    return t("The model's output couldn't be parsed");
  }
  if (
    TIMEOUT_TYPE.test(exceptionType) ||
    TIMEOUT_TEXT.test(value) ||
    CONNECTION_TEXT.test(text) ||
    (status !== null && (status >= 500 || status === 429))
  ) {
    return t('A dependency failed');
  }
  if (status === 401 || status === 403) {
    return t('Access denied');
  }
  if (status !== null && (location === 'tool' || location === 'agent')) {
    return t("The tool rejected the model's input");
  }
  if (location === 'tool' && shortType === 'ValueError' && handled) {
    return t("The tool rejected the model's input");
  }
  if (location === 'agent' && raisedInRunSpan) {
    return t("Error in the agent's code");
  }
  return null;
}

function getFailureLocation(node: AITraceSpanNode): FailureLocation {
  switch (getGenAiOpType(node)) {
    case 'tool':
      return 'tool';
    case 'ai_client':
      return 'model_call';
    case 'agent':
    case 'handoff':
      return 'agent';
    default:
      return 'other';
  }
}

/**
 * The exception the error was raised with: the last one, because chained
 * exceptions list the cause first.
 */
function getException(event: Event): ExceptionValue | undefined {
  const entry = event.entries?.find(item => item.type === EntryType.EXCEPTION);
  return entry?.data.values?.at(-1);
}

export function getEventFailureKind(event: Event, failingNode: AITraceSpanNode) {
  const exception = getException(event);
  return getFailureKind({
    location: getFailureLocation(failingNode),
    exceptionType: exception?.type ?? '',
    exceptionValue: exception?.value ?? (event.message || event.title || ''),
    handled:
      exception?.mechanism?.handled ??
      event.tags?.some(tag => tag.key === 'handled' && tag.value === 'yes') ??
      false,
    raisedInRunSpan: event.contexts.trace?.span_id === failingNode.id,
  });
}
