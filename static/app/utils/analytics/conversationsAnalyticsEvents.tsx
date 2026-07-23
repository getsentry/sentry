export type ConversationsEventParameters = {
  'conversations.detail.click-errors-link': Record<string, unknown>;
  'conversations.detail.click-trace-link': Record<string, unknown>;
  'conversations.detail.copy-conversation': Record<string, unknown>;
  'conversations.detail.copy-conversation-id': Record<string, unknown>;
  'conversations.detail.expand-thinking': {expanded: boolean};
  'conversations.detail.expand-tool-calls': {expanded: boolean};
  'conversations.detail.page-view': Record<string, unknown>;
  'conversations.detail.select-span': Record<string, unknown>;
  'conversations.detail.tab-switch': {
    fromTab: string;
    toTab: string;
  };
  'conversations.message.click': Record<string, unknown>;
  'conversations.message.click-tool-call': Record<string, unknown>;
  'conversations.onboarding.page-view': Record<string, unknown>;
  'conversations.page-view': Record<string, unknown>;
  'conversations.save_query_modal': {
    action: 'open' | 'submit';
    save_type?: 'save_new_query' | 'rename_query';
    ui_source?: 'table';
  };
  'conversations.table.page-view': Record<string, unknown>;
  'conversations.table.paginate': {
    direction: 'next' | 'previous';
  };
};

export const conversationsEventMap: Record<keyof ConversationsEventParameters, string> = {
  'conversations.onboarding.page-view': 'Conversations: Onboarding Page View',
  'conversations.page-view': 'Conversations: Page View',
  'conversations.save_query_modal': 'Conversations: Save Query Modal',
  'conversations.table.page-view': 'Conversations: Table Page View',
  'conversations.table.paginate': 'Conversations: Table Paginate',
  'conversations.detail.expand-thinking': 'Conversations: Detail Expand Thinking',
  'conversations.detail.expand-tool-calls': 'Conversations: Detail Expand Tool Calls',
  'conversations.detail.page-view': 'Conversations: Detail Page View',
  'conversations.detail.tab-switch': 'Conversations: Detail Tab Switch',
  'conversations.detail.select-span': 'Conversations: Detail Select Span',
  'conversations.detail.copy-conversation': 'Conversations: Detail Copy Conversation',
  'conversations.detail.copy-conversation-id':
    'Conversations: Detail Copy Conversation ID',
  'conversations.detail.click-trace-link': 'Conversations: Detail Click Trace Link',
  'conversations.detail.click-errors-link': 'Conversations: Detail Click Errors Link',
  'conversations.message.click': 'Conversations: Message Click',
  'conversations.message.click-tool-call': 'Conversations: Message Click Tool Call',
};
