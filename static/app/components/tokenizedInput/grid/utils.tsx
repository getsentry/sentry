import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

export function focusPrev<T>(state: ListState<T>, item: Node<T>) {
  const prev = state.collection.getKeyBefore(item.key);
  if (prev) {
    state.selectionManager.setFocused(true);
    state.selectionManager.setFocusedKey(prev);
  }
}

export function focusNext<T>(state: ListState<T>, item: Node<T>) {
  const next = state.collection.getKeyAfter(item.key);
  if (next) {
    state.selectionManager.setFocused(true);
    state.selectionManager.setFocusedKey(next);
  }
}
