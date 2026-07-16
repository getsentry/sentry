import type {ReactNode} from 'react';
import {createContext, useContext, useMemo} from 'react';
import type {z} from 'zod';

import {
  SEER_EMBED_SCHEMAS,
  type SeerEmbedName,
} from 'sentry/components/seer/markdown/embeds/schemas';

/**
 * Conversation-derived embed state ("the fold").
 *
 * Many embeds are stateful across the conversation — the latest `{% todos %}`
 * snapshot wins, PR-state embeds accumulate per repo, an interaction request
 * is "active" only until a later turn resolves it. Rather than one provider
 * per capability, a single `SeerConversationProvider` scans block contents
 * once and feeds every embed occurrence, in conversation order, to the folds
 * registered here. Each capability derives its state as a pure reduction over
 * the conversation; nothing is stored outside the blocks themselves.
 *
 * To add a capability: call `registerEmbedFold` in your embed's module (it is
 * imported via ./index.ts like the embed component itself) and read the state
 * with `useEmbedFoldState(yourFold)`.
 */

/**
 * Minimal structural view of a conversation block. The Explorer `Block` type
 * satisfies this as-is — pass `blocks` straight in, no mapping needed.
 */
export interface EmbedSourceBlock {
  id: string;
  message: {content: string | null};
}

export interface EmbedOccurrence<N extends SeerEmbedName> {
  blockId: string;
  blockIndex: number;
  data: z.output<(typeof SEER_EMBED_SCHEMAS)[N]['schema']>;
}

interface EmbedFold<N extends SeerEmbedName, S> {
  /** Initial state. `reduce` must be pure — return new state, don't mutate. */
  init: S;
  reduce: (state: S, occurrence: EmbedOccurrence<N>) => S;
  tag: N;
}

const foldRegistry = new Map<string, EmbedFold<SeerEmbedName, unknown>>();

export function registerEmbedFold<N extends SeerEmbedName, S>(
  fold: EmbedFold<N, S>
): EmbedFold<N, S> {
  foldRegistry.set(fold.tag, fold as EmbedFold<SeerEmbedName, unknown>);
  return fold;
}

// Matches complete `{% name %}<body>{% /name %}` tags for any tag name;
// occurrences whose name has no registered fold are skipped. Mirrors the
// BLOCK_RE grammar in utils/marked/extensions/tag.ts.
const EMBED_TAG_RE = /\{%\s+([\w-]+)\s+%\}([\s\S]*?)\{%\s+\/\1\s+%\}/g;

function runEmbedFolds(blocks: readonly EmbedSourceBlock[]): Map<string, unknown> {
  const state = new Map<string, unknown>();
  for (const fold of foldRegistry.values()) {
    state.set(fold.tag, fold.init);
  }
  blocks.forEach((block, blockIndex) => {
    const content = block.message.content;
    if (!content) {
      return;
    }
    for (const match of content.matchAll(EMBED_TAG_RE)) {
      const fold = foldRegistry.get(match[1]!);
      if (!fold) {
        continue;
      }
      let body: unknown;
      try {
        body = JSON.parse(match[2]!);
      } catch {
        continue;
      }
      const parsed = SEER_EMBED_SCHEMAS[fold.tag].schema.safeParse(body);
      if (!parsed.success) {
        continue;
      }
      state.set(
        fold.tag,
        fold.reduce(state.get(fold.tag), {
          blockId: block.id,
          blockIndex,
          data: parsed.data,
        })
      );
    }
  });
  return state;
}

const SeerConversationContext = createContext<ReadonlyMap<string, unknown> | undefined>(
  undefined
);

/**
 * Wrap the rendered conversation once; every registered fold derives its
 * state from the same single pass over `blocks`.
 */
export function SeerConversationProvider({
  blocks,
  children,
}: {
  blocks: readonly EmbedSourceBlock[];
  children: ReactNode;
}) {
  const state = useMemo(() => runEmbedFolds(blocks), [blocks]);
  return <SeerConversationContext value={state}>{children}</SeerConversationContext>;
}

/**
 * Read a fold's derived state. Returns `undefined` when rendering outside a
 * conversation (no provider — e.g. stories/previews), letting embeds choose a
 * standalone rendering.
 */
export function useEmbedFoldState<N extends SeerEmbedName, S>(
  fold: EmbedFold<N, S>
): S | undefined {
  const state = useContext(SeerConversationContext);
  if (state === undefined) {
    return undefined;
  }
  return state.get(fold.tag) as S;
}
