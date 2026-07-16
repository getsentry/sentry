import type {ReactNode} from 'react';
import {createContext, useContext, useMemo} from 'react';
import type {z} from 'zod';

import {
  SEER_EMBED_SCHEMAS,
  type SeerEmbedName,
} from 'sentry/components/seer/markdown/embeds/schemas';
import {MarkedLexer, type ExtendedToken, type Token} from 'sentry/utils/marked/marked';

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
  attrs: Record<string, string>;
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

// The same lexer the renderer uses produces the tag tokens (with attrs and a
// JSON-parsed body) — folds see exactly what renders, nothing more. Tags
// inside code fences, partial tags mid-stream, etc. are correctly not tags.
function visitTagTokens(
  tokens: readonly Token[],
  visit: (token: Extract<ExtendedToken, {type: 'tag'}>) => void
): void {
  for (const token of tokens) {
    if (token.type === 'tag') {
      visit(token as Extract<ExtendedToken, {type: 'tag'}>);
    }
    if ('tokens' in token && token.tokens) {
      visitTagTokens(token.tokens, visit);
    }
    if ('items' in token && token.items) {
      visitTagTokens(token.items, visit);
    }
  }
}

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
    visitTagTokens(MarkedLexer.lex(content), token => {
      const fold = foldRegistry.get(token.name);
      if (!fold) {
        return;
      }
      const parsed = SEER_EMBED_SCHEMAS[fold.tag].schema.safeParse(token.data);
      if (!parsed.success) {
        return;
      }
      state.set(
        fold.tag,
        fold.reduce(state.get(fold.tag), {
          attrs: token.attrs,
          blockId: block.id,
          blockIndex,
          data: parsed.data,
        })
      );
    });
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
