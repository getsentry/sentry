import type {ReactNode} from 'react';
import {createContext, useContext, useMemo} from 'react';

import {
  EmbedReferenceContext,
  embedReferenceSchema,
  type EmbedReference,
  type EmbedReferenceResolver,
} from 'sentry/components/seer/markdown/embedReferences';
import type {Block} from 'sentry/views/seerExplorer/types';

const ReferenceRegistryContext = createContext({
  positions: new Map<string, number>(),
  references: new Map<string, {blockIndex: number; reference: EmbedReference}>(),
});

export function EmbedReferenceRegistryProvider({
  blocks,
  children,
}: {
  blocks: Block[];
  children: ReactNode;
}) {
  const registry = useMemo(() => collectEmbedReferences(blocks), [blocks]);

  return (
    <ReferenceRegistryContext.Provider value={registry}>
      {children}
    </ReferenceRegistryContext.Provider>
  );
}

export function collectEmbedReferences(blocks: Block[]) {
  const positions = new Map<string, number>();
  const references = new Map<string, {blockIndex: number; reference: EmbedReference}>();
  blocks.forEach((block, blockIndex) => {
    positions.set(block.id, blockIndex);
    for (const result of block.tool_results ?? []) {
      // Code Mode publishes effects only after a successful execute. Other
      // tools' structured payloads are not trusted issuers of references.
      if (
        result?.tool_call_function !== 'sentry_api_execute' ||
        !Array.isArray(result.structuredContent?.embeds)
      ) {
        continue;
      }
      for (const candidate of result.structuredContent.embeds) {
        const parsed = embedReferenceSchema.safeParse(candidate);
        if (parsed.success && !references.has(parsed.data.id)) {
          references.set(parsed.data.id, {blockIndex, reference: parsed.data});
        }
      }
    }
  });
  return {positions, references};
}

export function BlockEmbedProvider({
  block,
  children,
}: {
  block: Block;
  children: ReactNode;
}) {
  if (block.embed_protocol !== 'references-v1') {
    return (
      <EmbedReferenceContext.Provider value={null}>
        {children}
      </EmbedReferenceContext.Provider>
    );
  }
  return <ReferenceBlock block={block}>{children}</ReferenceBlock>;
}

function ReferenceBlock({block, children}: {block: Block; children: ReactNode}) {
  const registry = useContext(ReferenceRegistryContext);
  const resolver = useMemo<EmbedReferenceResolver>(() => {
    const position = registry.positions.get(block.id) ?? -1;
    return (id, includeCurrentBlock) => {
      const entry = registry.references.get(id);
      return entry && entry.blockIndex < position + (includeCurrentBlock ? 1 : 0)
        ? entry.reference
        : undefined;
    };
  }, [block.id, registry]);

  return (
    <EmbedReferenceContext.Provider value={resolver}>
      {children}
    </EmbedReferenceContext.Provider>
  );
}
