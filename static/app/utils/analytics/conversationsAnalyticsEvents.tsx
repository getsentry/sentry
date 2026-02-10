export type ConversationDrawerOpenSource =
  | 'direct_link'
  | 'table_conversation_id'
  | 'table_input'
  | 'table_output';

export type ConversationsEventParameters = {
  'conversations.drawer.open': {
    source: ConversationDrawerOpenSource;
  };
  'conversations.drawer.span-select': Record<string, unknown>;
  'conversations.drawer.tab-switch': {
    fromTab: string;
    toTab: string;
  };
  'conversations.page-view': Record<string, unknown>;
};

export const conversationsEventMap: Record<keyof ConversationsEventParameters, string> = {
  'conversations.page-view': 'Conversations: Page View',
  'conversations.drawer.open': 'Conversations: Drawer Open',
  'conversations.drawer.tab-switch': 'Conversations: Drawer Tab Switch',
  'conversations.drawer.span-select': 'Conversations: Drawer Span Select',
};
