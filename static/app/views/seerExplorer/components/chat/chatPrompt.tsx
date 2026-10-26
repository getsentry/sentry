import {AssistantMessage, MessageRow} from '@sentry/scraps/chat';
import {Text} from '@sentry/scraps/text';

/**
 * An "Ask Seer" question, shown as Seer's. Plain text: the frontend wrote it, so it
 * never goes through the markdown or embed renderer.
 */
export function ChatPromptMessage({text}: {text: string}) {
  return (
    <MessageRow from="assistant">
      <AssistantMessage>
        <Text>{text}</Text>
      </AssistantMessage>
    </MessageRow>
  );
}
