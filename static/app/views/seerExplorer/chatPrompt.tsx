import type {Block} from 'sentry/views/seerExplorer/types';

/**
 * An "Ask Seer" question: shown in Explorer as Seer's, and sent with the user's reply.
 * `context` is the JSON the entry point captured when it was clicked.
 */
export type ChatPrompt = {
  text: string;
  context?: string;
};

/** The question a user message answered, which the chat endpoint stores in its metadata. */
export function getBlockChatPrompt(block: Block): ChatPrompt | null {
  const text = block.message.metadata?.chat_prompt;
  if (!text) {
    return null;
  }
  return {text, context: block.message.metadata?.chat_prompt_context};
}

/** The JSON a prompt's context travels as, or nothing if it can't be serialized. */
export function serializeChatPromptContext(context: unknown): string | undefined {
  if (context === undefined) {
    return undefined;
  }
  try {
    return JSON.stringify(context);
  } catch {
    // Not serializable (e.g. circular); the question still works without it.
    return undefined;
  }
}

/** The metadata the chat endpoint stores for a prompt, mirrored on the optimistic block. */
export function toChatPromptMetadata(prompt: ChatPrompt): Record<string, string> {
  if (prompt.context === undefined) {
    return {chat_prompt: prompt.text};
  }
  return {chat_prompt: prompt.text, chat_prompt_context: prompt.context};
}
