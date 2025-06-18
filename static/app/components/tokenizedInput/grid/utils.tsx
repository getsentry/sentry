import type {ListState} from '@react-stately/list';
import type {Key} from '@react-types/shared';

export function focusTarget<T>(state: ListState<T>, target: Key | null) {
  if (target) {
    state.selectionManager.setFocused(true);
    state.selectionManager.setFocusedKey(target);
  }
}
