import {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import {FieldValueType} from 'sentry/utils/fields';

export type ConversationColumnKey =
  | 'conversationId'
  | 'llmCalls'
  | 'user'
  | 'toolCalls'
  | 'errors'
  | 'cost'
  | 'timestamp'
  | 'input'
  | 'output'
  | 'inputTokens'
  | 'outputTokens';

interface ColumnDefinition {
  name: string;
  type: FieldValueType;
  width: number;
}

export const CONVERSATION_COLUMNS: Record<ConversationColumnKey, ColumnDefinition> = {
  conversationId: {name: t('Conv. ID'), width: 150, type: FieldValueType.STRING},
  llmCalls: {name: t('LLM Calls'), width: 100, type: FieldValueType.INTEGER},
  user: {name: t('User'), width: COL_WIDTH_UNDEFINED, type: FieldValueType.STRING},
  toolCalls: {name: t('Tool Calls'), width: 120, type: FieldValueType.INTEGER},
  errors: {name: t('Errors'), width: 100, type: FieldValueType.INTEGER},
  cost: {name: t('Cost'), width: 110, type: FieldValueType.CURRENCY},
  timestamp: {name: t('Last Message'), width: 140, type: FieldValueType.DATE},
  input: {name: t('Input'), width: 250, type: FieldValueType.STRING},
  output: {name: t('Output'), width: 250, type: FieldValueType.STRING},
  inputTokens: {name: t('Input Tokens'), width: 120, type: FieldValueType.INTEGER},
  outputTokens: {name: t('Output Tokens'), width: 130, type: FieldValueType.INTEGER},
};

export const ALL_CONVERSATION_COLUMNS: ConversationColumnKey[] = [
  'conversationId',
  'user',
  'llmCalls',
  'toolCalls',
  'errors',
  'cost',
  'timestamp',
  'input',
  'output',
  'inputTokens',
  'outputTokens',
];

export const DEFAULT_CONVERSATION_COLUMNS: ConversationColumnKey[] = [
  'conversationId',
  'user',
  'llmCalls',
  'toolCalls',
  'errors',
  'cost',
  'timestamp',
];

export const RIGHT_ALIGNED_CONVERSATION_COLUMNS = new Set<ConversationColumnKey>([
  'timestamp',
]);

function isConversationColumnKey(value: string): value is ConversationColumnKey {
  return value in CONVERSATION_COLUMNS;
}

/**
 * Keep only valid column keys, preserving order and duplicates so a column can
 * appear more than once. Falls back to the defaults when nothing usable remains
 * so the table never renders an empty column set.
 */
export function parseConversationColumns(
  values: readonly string[] | null
): ConversationColumnKey[] {
  const parsed = (values ?? []).filter(isConversationColumnKey);
  return parsed.length > 0 ? parsed : [...DEFAULT_CONVERSATION_COLUMNS];
}
