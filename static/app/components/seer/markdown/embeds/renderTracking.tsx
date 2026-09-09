import {createContext, useContext, useEffect} from 'react';
import {GEN_AI_CONVERSATION_ID} from '@sentry/conventions/attributes';
import * as Sentry from '@sentry/react';

/**
 * Identifies where a Seer embed was rendered, so a render can be attributed to
 * a conversation and a message rather than just a page load.
 *
 * Supplied by the surface rendering the markdown. A surface that cannot name
 * both ids supplies nothing and its embeds go untracked -- better a missing
 * surface than rows that cannot be deduplicated.
 */
export interface SeerEmbedScope {
  /** Run the embed was rendered in. */
  conversationId: string;
  /**
   * Message within the run. Must be the server-assigned id: it is what makes a
   * render deduplicable across viewers and reloads. Optimistic client-side ids
   * change once the server responds and would double count.
   */
  messageId: string;
  /** Product surface, so one embed type can be compared across surfaces. */
  surface: string;
}

export const SeerEmbedScopeContext = createContext<SeerEmbedScope | null>(null);

/**
 * Embeds already reported this page load.
 *
 * Seer markdown re-lexes and re-renders on every streamed chunk, and a
 * paragraph holding an inline embed remounts each time text is appended after
 * it, so an embed would otherwise report once per chunk. Keyed on the same
 * composite the query counts distinct on, which makes this an optimisation
 * rather than a correctness requirement: a missed dedup (a reopened
 * conversation, a second tab) collapses again at query time.
 */
const reportedEmbeds = new Set<string>();

interface TrackEmbedRenderedOptions {
  /**
   * Position among all embeds in the message, in document order. Undefined when
   * the markdown was not rendered through `Markdown` (which assigns it).
   */
  index: number | undefined;
  level: 'block' | 'inline';
  name: string;
  /**
   * False when the embed's props failed validation. Such an embed renders
   * nothing, so counting it would overstate what users actually saw.
   */
  rendered: boolean;
}

/**
 * Records that an embed was rendered, once per embed instance per page load.
 *
 * Emitted as a log rather than a metric because the question it answers is
 * "how many distinct embeds", which needs `count_unique` over an identifier --
 * an aggregate the logs dataset offers and a pre-aggregated counter cannot.
 */
export function useTrackEmbedRendered({
  index,
  level,
  name,
  rendered,
}: TrackEmbedRenderedOptions): void {
  const scope = useContext(SeerEmbedScopeContext);

  useEffect(() => {
    if (!rendered || !scope || index === undefined) {
      return;
    }

    const messageKey = `${scope.conversationId}:${scope.messageId}`;
    const embedKey = `${messageKey}:${index}`;
    if (reportedEmbeds.has(embedKey)) {
      return;
    }
    reportedEmbeds.add(embedKey);

    Sentry.logger.info('Seer embed rendered', {
      'seer_embed.name': name,
      'seer_embed.level': level,
      'seer_embed.index': index,
      'seer_embed.surface': scope.surface,
      // The conversation is written twice on purpose. The convention name is
      // what correlates this render with everything else describing the same
      // conversation -- spans, other producers -- while the `seer_embed.`
      // copy keeps every attribute of this log under one prefix, so a query
      // for embeds does not have to know that one of its fields is namespaced
      // somewhere else.
      //
      // The message has no such pair: `gen_ai.response.id` means the
      // provider's completion id, not a Seer block id, so writing a block id
      // there would put two meanings behind one key.
      [GEN_AI_CONVERSATION_ID]: scope.conversationId,
      'seer_embed.conversation_id': scope.conversationId,
      'seer_embed.message_id': scope.messageId,
      // Pre-composed because the query layer cannot concatenate attributes:
      // `count_unique(seer_embed.message_key)` counts messages that showed an
      // embed of a type, `count_unique(seer_embed.embed_key)` counts embeds.
      'seer_embed.message_key': messageKey,
      'seer_embed.embed_key': embedKey,
    });
  }, [index, level, name, rendered, scope]);
}
