import {useContext} from 'react';

import {
  registerEmbedFold,
  useEmbedFoldState,
} from 'sentry/components/seer/markdown/embeds/conversation';
import {SeerEmbedBlockContext} from 'sentry/components/seer/markdown/embeds/registry';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {TodoList, type TodoListItem} from 'sentry/components/seer/todoList';

/**
 * Todo snapshots are complete replacements, so the conversation's todo state
 * is simply the block holding the last valid `{% todos %}` occurrence.
 */
const todosFold = registerEmbedFold({
  tag: 'todos',
  init: null as string | null,
  reduce: (_latest, occurrence) => occurrence.blockId,
});

function TodosEmbed({items}: {items: TodoListItem[]}) {
  const latestTodosBlockId = useEmbedFoldState(todosFold);
  const blockId = useContext(SeerEmbedBlockContext);

  // Outside a conversation (stories, previews) there is no provider — render.
  // Inside one, render only from the latest todos-bearing block.
  const isLatest =
    latestTodosBlockId === undefined ||
    (latestTodosBlockId !== null && latestTodosBlockId === blockId);

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
