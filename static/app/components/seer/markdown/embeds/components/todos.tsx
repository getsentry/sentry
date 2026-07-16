import type {ReactNode} from 'react';
import {createContext, useContext, useMemo} from 'react';

import {SeerEmbedBlockContext} from 'sentry/components/seer/markdown/embeds/registry';
import {SEER_EMBED_SCHEMAS} from 'sentry/components/seer/markdown/embeds/schemas';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {TodoList, type TodoListItem} from 'sentry/components/seer/todoList';

const TODOS_TAG_RE = /\{%\s+todos\s+%\}([\s\S]*?)\{%\s+\/todos\s+%\}/g;

interface TodosSourceBlock {
  content: string | null | undefined;
  id: string;
}

/**
 * Returns the id of the last block whose content contains a valid
 * `{% todos %}` tag. The conversation's todo state is a complete-replacement
 * snapshot, so only the latest occurrence is current.
 */
export function findLatestTodosBlockId(blocks: TodosSourceBlock[]): string | null {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const content = blocks[i]!.content;
    if (!content) {
      continue;
    }
    const matches = [...content.matchAll(TODOS_TAG_RE)];
    for (let j = matches.length - 1; j >= 0; j--) {
      let data: unknown;
      try {
        data = JSON.parse(matches[j]![1]!);
      } catch {
        continue;
      }
      if (SEER_EMBED_SCHEMAS.todos.schema.safeParse(data).success) {
        return blocks[i]!.id;
      }
    }
  }
  return null;
}

const SeerTodosContext = createContext<{latestTodosBlockId: string | null} | undefined>(
  undefined
);

/**
 * Conversation-scoped todo state, derived from block data (not the render
 * tree): the latest valid `{% todos %}` occurrence wins. Wrap the rendered
 * conversation and pass the blocks' `{id, content}` pairs.
 */
export function SeerTodosProvider({
  blocks,
  children,
}: {
  blocks: TodosSourceBlock[];
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({latestTodosBlockId: findLatestTodosBlockId(blocks)}),
    [blocks]
  );
  return <SeerTodosContext value={value}>{children}</SeerTodosContext>;
}

function TodosEmbed({items}: {items: TodoListItem[]}) {
  const todosState = useContext(SeerTodosContext);
  const blockId = useContext(SeerEmbedBlockContext);

  // Outside a conversation (stories, previews) there is no provider — render.
  // Inside one, render only from the latest todos-bearing block.
  const isLatest =
    todosState === undefined ||
    (todosState.latestTodosBlockId !== null && todosState.latestTodosBlockId === blockId);

  if (!isLatest) {
    return null;
  }
  return <TodoList todos={items} />;
}

export const Todos = defineSeerEmbed({
  name: 'todos',
  render({items}) {
    return <TodosEmbed items={items} />;
  },
});
