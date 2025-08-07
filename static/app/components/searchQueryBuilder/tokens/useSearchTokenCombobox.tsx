import type {FocusEvent, KeyboardEvent} from 'react';
import {useMemo, useRef} from 'react';
import type {useComboBox} from '@react-aria/combobox';
import {getItemId, listData} from '@react-aria/listbox';
import {useMenuTrigger} from '@react-aria/menu';
import {ListKeyboardDelegate, useSelectableCollection} from '@react-aria/selection';
import {useTextField} from '@react-aria/textfield';
import {chain, mergeProps, useLabels} from '@react-aria/utils';
import {privateValidationStateProp} from '@react-stately/form';
import type {BaseEvent} from '@react-types/shared';

import {t} from 'sentry/locale';

/**
 * Modified version of @react-aria/combobox/useCombobox to support tokens within the search query builder.
 *
 * The API remains similar to useCombobox, so use as you would otherwise. There are some behavior
 * changes:
 *
 * - Removal of focus behavior when there is no focused item [1]. This caused issues where, after
 * an item was selected, the input would be refocused instead of jumping to the next token.
 *
 *
 * [1]: https://github.com/adobe/react-spectrum/pull/7829/files#diff-71a31c1ead10f8d488699920aeb3a0f81abcde0e849b8c36dbf10cf32f5881a6R346-R352
 */
export function useSearchTokenCombobox<T>(
  props: Parameters<typeof useComboBox<T>>[0],
  state: Parameters<typeof useComboBox<T>>[1]
): Pick<ReturnType<typeof useComboBox<T>>, 'inputProps' | 'listBoxProps' | 'labelProps'> {
  const {
    popoverRef,
    inputRef,
    listBoxRef,
    keyboardDelegate,
    layoutDelegate,
    shouldFocusWrap,
    isReadOnly,
    isDisabled,
  } = props;
  const backupBtnRef = useRef(null);
  const buttonRef = props.buttonRef ?? backupBtnRef;

  const {menuTriggerProps, menuProps} = useMenuTrigger<T>(
    {
      type: 'listbox',
      isDisabled: isDisabled || isReadOnly,
    },
    state,
    buttonRef
  );

  // Set listbox id so it can be used when calling getItemId later
  listData.set(state, {id: menuProps.id ?? ''});

  // By default, a KeyboardDelegate is provided which uses the DOM to query layout information (e.g. for page up/page down).
  // When virtualized, the layout object will be passed in as a prop and override this.
  const {collection} = state;
  const {disabledKeys} = state.selectionManager;
  const delegate = useMemo(
    () =>
      keyboardDelegate ||
      new ListKeyboardDelegate({
        collection,
        disabledKeys,
        ref: listBoxRef,
        layoutDelegate,
      }),
    [keyboardDelegate, layoutDelegate, collection, disabledKeys, listBoxRef]
  );

  // Use useSelectableCollection to get the keyboard handlers to apply to the textfield
  const {collectionProps} = useSelectableCollection({
    selectionManager: state.selectionManager,
    keyboardDelegate: delegate,
    disallowTypeAhead: true,
    disallowEmptySelection: true,
    shouldFocusWrap,
    ref: inputRef,
    // Prevent item scroll behavior from being applied here, should be handled in the user's Popover + ListBox component
    isVirtualized: true,
  });

  const onKeyDown = (e: BaseEvent<KeyboardEvent<any>>) => {
    if (e.nativeEvent.isComposing) {
      return;
    }
    switch (e.key) {
      case 'Enter':
      case 'Tab':
        // Prevent form submission if menu is open since we may be selecting a option
        if (state.isOpen && e.key === 'Enter') {
          e.preventDefault();
        }

        state.commit();
        break;
      case 'Escape':
        if (
          state.selectedKey !== null ||
          state.inputValue === '' ||
          props.allowsCustomValue
        ) {
          e.continuePropagation();
        }
        state.revert();
        break;
      case 'ArrowDown':
        state.open('first', 'manual');
        break;
      case 'ArrowUp':
        state.open('last', 'manual');
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        state.selectionManager.setFocusedKey(null);
        break;
      default:
        break;
    }
  };

  const onBlur = (e: FocusEvent<HTMLInputElement>) => {
    const blurFromButton = buttonRef?.current && buttonRef.current === e.relatedTarget;
    const blurIntoPopover = popoverRef.current?.contains(e.relatedTarget);
    // Ignore blur if focused moved to the button(if exists) or into the popover.
    if (blurFromButton || blurIntoPopover) {
      return;
    }

    if (props.onBlur) {
      props.onBlur(e);
    }

    state.setFocused(false);
  };

  const onFocus = (e: FocusEvent<HTMLInputElement>) => {
    if (state.isFocused) {
      return;
    }

    if (props.onFocus) {
      props.onFocus(e);
    }

    state.setFocused(true);
  };

  const {labelProps, inputProps} = useTextField(
    {
      ...props,
      onChange: state.setInputValue,
      onKeyDown: isReadOnly
        ? props.onKeyDown
        : chain(state.isOpen && collectionProps.onKeyDown, onKeyDown, props.onKeyDown),
      onBlur: onBlur as (e: FocusEvent<Element, Element>) => void,
      value: state.inputValue,
      onFocus: onFocus as (e: FocusEvent<Element, Element>) => void,
      autoComplete: 'off',
      validate: undefined,
      [privateValidationStateProp]: state,
    },
    inputRef
  );

  const listBoxProps = useLabels({
    id: menuProps.id,
    'aria-label': t('Suggestions'),
    'aria-labelledby': props['aria-labelledby'] || labelProps.id,
  });

  const focusedItem =
    state.selectionManager.focusedKey !== null && state.isOpen
      ? state.collection.getItem(state.selectionManager.focusedKey)
      : undefined;

  return {
    labelProps,
    inputProps: mergeProps(inputProps, {
      role: 'combobox',
      'aria-expanded': menuTriggerProps['aria-expanded'],
      'aria-controls': state.isOpen ? menuProps.id : undefined,
      'aria-autocomplete': 'list',
      'aria-activedescendant': focusedItem
        ? getItemId(state, focusedItem.key)
        : undefined,
      autoCorrect: 'off',
      spellCheck: 'false',
    }),
    listBoxProps: mergeProps(menuProps, listBoxProps, {
      autoFocus: state.focusStrategy || true,
      shouldUseVirtualFocus: true,
      shouldSelectOnPressUp: true,
      shouldFocusOnHover: true,
      linkBehavior: 'selection' as const,
    }),
  };
}
