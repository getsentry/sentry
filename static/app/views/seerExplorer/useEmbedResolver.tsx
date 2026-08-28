import {useMemo} from 'react';

import type {SeerEmbedResolver} from 'sentry/components/seer/markdown';
import type {Block} from 'sentry/views/seerExplorer/types';

/**
 * Resolves an embed reference against every tool result in the conversation.
 *
 * A tool result's `structuredContent` reaches only its own renderer, but seer addresses an embed by
 * block so a later assistant message can render a payload an earlier tool call produced. Built as a
 * forward index rather than a backward walk: one pass, memoized, so a tag costs a map lookup.
 */
export function useEmbedResolver(blocks: Block[]): SeerEmbedResolver {
  const index = useMemo(() => {
    const byAddress = new Map<string, unknown>();
    for (const block of blocks) {
      for (const result of block.tool_results ?? []) {
        for (const [name, lane] of Object.entries(result?.structuredContent ?? {})) {
          if (!Array.isArray(lane)) {
            continue;
          }
          for (const entry of lane) {
            if (entry && typeof entry === 'object' && 'key' in entry) {
              byAddress.set(`${block.id}.${name}.${entry.key}`, entry.data);
            }
          }
        }
      }
    }
    return byAddress;
  }, [blocks]);

  return useMemo(
    () => (blockId, name, key) => index.get(`${blockId}.${name}.${key}`),
    [index]
  );
}
