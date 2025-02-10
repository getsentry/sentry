import {useCallback} from 'react';
import {getFocusableTreeWalker} from '@react-aria/focus';
import type {ListState} from '@react-stately/list';
import type {Key, Node} from '@react-types/shared';

import type {
  SelectOptionOrSectionWithKey,
  SelectSectionWithKey,
} from 'sentry/components/compactSelect/types';
import type {ParseResultToken} from 'sentry/components/searchSyntax/parser';
import {defined} from 'sentry/utils';
import {type FieldDefinition, FieldKind, FieldValueType} from 'sentry/utils/fields';

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

export function getDefaultValueForValueType(valueType: FieldValueType | null): string {
  switch (valueType) {
    case FieldValueType.BOOLEAN:
      return 'true';
    case FieldValueType.INTEGER:
    case FieldValueType.NUMBER:
      return '100';
    case FieldValueType.DATE:
      return '-24h';
    case FieldValueType.DURATION:
      return '10ms';
    case FieldValueType.SIZE:
      return '10bytes';
    case FieldValueType.PERCENTAGE:
      return '0.5';
    case FieldValueType.STRING:
    default:
      return '""';
  }
}

export function getDefaultFilterValue({
  fieldDefinition,
}: {
  fieldDefinition: FieldDefinition | null;
}): string {
  if (!fieldDefinition) {
    return '""';
  }

  if (defined(fieldDefinition.defaultValue)) {
    return fieldDefinition.defaultValue;
  }

  return getDefaultValueForValueType(fieldDefinition.valueType);
}

function getInitialFilterKeyText(key: string, fieldDefinition: FieldDefinition | null) {
  if (fieldDefinition?.kind === FieldKind.FUNCTION) {
    if (fieldDefinition.parameters) {
      const parametersText = fieldDefinition.parameters
        .filter(param => defined(param.defaultValue))
        .map(param => param.defaultValue)
        .join(',');

      return `${key}(${parametersText})`;
    }

    return `${key}()`;
  }

  return key;
}

function getInitialValueType(fieldDefinition: FieldDefinition | null) {
  if (!fieldDefinition) {
    return FieldValueType.STRING;
  }

  if (fieldDefinition.parameterDependentValueType) {
    return fieldDefinition.parameterDependentValueType(
      fieldDefinition.parameters?.map(p => p.defaultValue ?? null) ?? []
    );
  }

  return fieldDefinition.valueType ?? FieldValueType.STRING;
}

export function getInitialFilterText(
  key: string,
  fieldDefinition: FieldDefinition | null
) {
  const defaultValue = getDefaultFilterValue({fieldDefinition});

  const keyText = getInitialFilterKeyText(key, fieldDefinition);
  const valueType = getInitialValueType(fieldDefinition);

  switch (valueType) {
    case FieldValueType.INTEGER:
    case FieldValueType.NUMBER:
    case FieldValueType.DURATION:
    case FieldValueType.SIZE:
    case FieldValueType.PERCENTAGE:
      return `${keyText}:>${defaultValue}`;
    case FieldValueType.STRING:
    default:
      return `${keyText}:${defaultValue}`;
  }
}

export function mergeSets<T>(...sets: Array<Set<T>>) {
  const combinedSet = new Set<T>();
  for (const set of sets) {
    for (const value of set) {
      combinedSet.add(value);
    }
  }
  return combinedSet;
}

export function itemIsSection(
  item: SelectOptionOrSectionWithKey<string>
): item is SelectSectionWithKey<string> {
  return 'options' in item;
}

export function findItemInSections<T extends SelectOptionOrSectionWithKey<string>>(
  items: T[],
  key: Key
): T | null {
  for (const item of items) {
    if (itemIsSection(item)) {
      const option = item.options.find(child => child.key === key);
      if (option) {
        return option as T;
      }
    } else {
      if (item.key === key) {
        return item;
      }
    }
  }
  return null;
}
