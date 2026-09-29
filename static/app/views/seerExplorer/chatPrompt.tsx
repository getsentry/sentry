import type {Block} from 'sentry/views/seerExplorer/types';

/** How long an unanswered "Ask Seer" question stays in Explorer. */
export const CHAT_PROMPT_TTL_MS = 60 * 60 * 1000;

/**
 * An "Ask Seer" question: shown in Explorer as Seer's, and sent with the user's reply.
 * `context` is the JSON the entry point captured when it was clicked.
 */
export type ChatPrompt = {
  text: string;
  context?: string;
};

export type PendingChatPrompt = ChatPrompt & {
  /** When the question was opened, so it can expire if nobody answers it. */
  openedAt: number;
};

/** The question a user message answered, which the chat endpoint stores in its metadata. */
export function getBlockChatPrompt(block: Block): ChatPrompt | null {
  const text = block.message.metadata?.chat_prompt;
  if (!text) {
    return null;
  }
  return {text, context: block.message.metadata?.chat_prompt_context};
}

/** The metadata the chat endpoint stores for a prompt, mirrored on the optimistic block. */
export function toChatPromptMetadata(prompt: ChatPrompt): Record<string, string> {
  if (prompt.context === undefined) {
    return {chat_prompt: prompt.text};
  }
  return {chat_prompt: prompt.text, chat_prompt_context: prompt.context};
}
