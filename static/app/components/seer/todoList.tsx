import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

export interface TodoListItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

/**
 * Read-only todo checklist shared by the legacy `block.todos` sidecar path and
 * the `{% todos %}` markdown embed.
 */
export function TodoList({todos}: {todos: TodoListItem[]}) {
  return (
    <Stack as="ul" gap="sm" padding="0">
      {todos.map(todo => {
        const checked = todo.status === 'completed';
        return (
          <Flex key={todo.content} as="li" gap="sm" align="center">
            <Checkbox size="xs" checked={checked} readOnly />
            <Text size="xs" monospace strikethrough={checked} variant="muted">
              {todo.content}
            </Text>
          </Flex>
        );
      })}
    </Stack>
  );
}
