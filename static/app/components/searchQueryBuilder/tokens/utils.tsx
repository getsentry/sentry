import {useCallback} from 'react';
import {getFocusableTreeWalker} from '@react-aria/focus';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import type {ParseResultToken} from 'sentry/components/searchSyntax/parser';
import {FieldKey, FieldValueType, getFieldDefinition} from 'sentry/utils/fields';

export function shiftFocusToChild(
  element: HTMLElement,
  item: Node<ParseResultToken>,
  state: ListState<ParseResultToken>
) {
  // Ensure that the state is updated correctly
  state.selectionManager.setFocusedKey(item.key);

  // When this row gains focus, immediately shift focus to the input
  const walker = getFocusableTreeWalker(element);
  const nextNode = walker.nextNode();
  if (nextNode) {
    (nextNode as HTMLElement).focus();
  }
}

export function useShiftFocusToChild(
  item: Node<ParseResultToken>,
  state: ListState<ParseResultToken>
) {
  const onFocus = useCallback(
    (e: React.FocusEvent<HTMLDivElement, Element>) => {
      shiftFocusToChild(e.currentTarget, item, state);
    },
    [item, state]
  );

  return {
    shiftFocusProps: {onFocus},
  };
}

export function getDefaultFilterValue({key}: {key: string}): string {
  const fieldDef = getFieldDefinition(key);

  if (!fieldDef) {
    return '""';
  }

  if (key === FieldKey.IS) {
    return 'unresolved';
  }

  switch (fieldDef.valueType) {
    case FieldValueType.BOOLEAN:
      return 'true';
    case FieldValueType.INTEGER:
    case FieldValueType.NUMBER:
      return '100';
    case FieldValueType.DATE:
      return '-24h';
    case FieldValueType.STRING:
    default:
      return '""';
  }
}
