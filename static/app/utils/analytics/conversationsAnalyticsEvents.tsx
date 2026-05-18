type ConversationOpenSource = 'table_conversation_id' | 'table_input' | 'table_output';

export type ConversationsEventParameters = {
  'conversations.detail.click-errors-link': Record<string, unknown>;
  'conversations.detail.click-trace-link': Record<string, unknown>;
  'conversations.detail.copy-conversation-id': Record<string, unknown>;
  'conversations.detail.page-view': Record<string, unknown>;
  'conversations.detail.select-span': Record<string, unknown>;
  'conversations.detail.tab-switch': {
    fromTab: string;
    toTab: string;
  };
  'conversations.message.click': Record<string, unknown>;
  'conversations.message.click-tool-call': Record<string, unknown>;
  'conversations.page-view': Record<string, unknown>;
  'conversations.table.open': {
    source: ConversationOpenSource;
  };
  'conversations.table.paginate': {
    direction: 'next' | 'previous';
  };
};

export const conversationsEventMap: Record<keyof ConversationsEventParameters, string> = {
  'conversations.page-view': 'Conversations: Page View',
  'conversations.table.open': 'Conversations: Table Open',
  'conversations.table.paginate': 'Conversations: Table Paginate',
  'conversations.detail.page-view': 'Conversations: Detail Page View',
  'conversations.detail.tab-switch': 'Conversations: Detail Tab Switch',
  'conversations.detail.select-span': 'Conversations: Detail Select Span',
  'conversations.detail.copy-conversation-id':
    'Conversations: Detail Copy Conversation ID',
  'conversations.detail.click-trace-link': 'Conversations: Detail Click Trace Link',
  'conversations.detail.click-errors-link': 'Conversations: Detail Click Errors Link',
  'conversations.message.click': 'Conversations: Message Click',
  'conversations.message.click-tool-call': 'Conversations: Message Click Tool Call',
};
