import {Fragment, useCallback, useContext, useMemo, useRef} from 'react';
import {AriaListBoxOptions, useListBox} from '@react-aria/listbox';
import {mergeProps} from '@react-aria/utils';
import {ListState} from '@react-stately/list';

import {t} from 'sentry/locale';
import {FormSize} from 'sentry/utils/theme';

import {SelectContext} from '../control';
import {SelectFilterContext} from '../list';
import {ListLabel, ListSeparator, ListWrap, SizeLimitMessage} from '../styles';
import {SelectSection} from '../types';

import {ListBoxOption} from './option';
import {ListBoxSection} from './section';

interface ListBoxProps
  extends Omit<
      React.HTMLAttributes<HTMLUListElement>,
      'onBlur' | 'onFocus' | 'autoFocus'
    >,
    Omit<
      AriaListBoxOptions<any>,
      | 'children'
      | 'items'
      | 'disabledKeys'
      | 'selectedKeys'
      | 'defaultSelectedKeys'
      | 'onSelectionChange'
      | 'autoFocus'
    > {
  /**
   * Keyboard event handler, to be attached to the list (`ul`) element, to seamlessly
   * move focus from one composite list to another when an arrow key is pressed. Returns
   * a boolean indicating whether the keyboard event was intercepted. If yes, then no
   * further callback function should be run.
   */
  keyDownHandler: (e: React.KeyboardEvent<HTMLUListElement>) => boolean;
  /**
   * Object containing the selection state and focus position, needed for
   * `useListBox()`.
   */
  listState: ListState<any>;
  /**
   * Text label to be rendered as heading on top of grid list.
   */
  label?: React.ReactNode;
  /**
   * To be called when the user toggle-selects a whole section (applicable when sections
   * have `showToggleAllButton` set to true.) Note: this will be called in addition to
   * and before `onChange`.
   */
  onSectionToggle?: (
    section: SelectSection<React.Key>,
    type: 'select' | 'unselect'
  ) => void;
  size?: FormSize;
  /**
   * Message to be displayed when some options are hidden due to `sizeLimit`.
   */
  sizeLimitMessage?: string;
}

/**
 * A list box with accessibile behaviors & attributes.
 * https://react-spectrum.adobe.com/react-aria/useListBox.html
 *
 * Unlike grid lists, list boxes are one-dimensional. Users can press Arrow Up/Down to
 * move between options. All interactive elements (buttons/links) inside list box
 * options are unreachable via keyboard (only the options themselves can be focused on).
 * If interactive children are necessary, consider using grid lists instead (by setting
 * the `grid` prop on CompactSelect to true).
 */
function ListBox({
  listState,
  size = 'md',
  shouldFocusWrap = true,
  shouldFocusOnHover = true,
  onSectionToggle,
  sizeLimitMessage,
  keyDownHandler,
  label,
  ...props
}: ListBoxProps) {
  const ref = useRef<HTMLUListElement>(null);
  const {listBoxProps, labelProps} = useListBox(
    {
      ...props,
      label,
      shouldFocusWrap,
      shouldFocusOnHover,
      shouldSelectOnPressUp: true,
    },
    listState,
    ref
  );

  const onKeyDown = useCallback<React.KeyboardEventHandler<HTMLUListElement>>(
    e => {
      const continueCallback = keyDownHandler?.(e);
      // Prevent list box from clearing value on Escape key press
      continueCallback && e.key !== 'Escape' && listBoxProps.onKeyDown?.(e);
    },
    [keyDownHandler, listBoxProps]
  );

  const {overlayIsOpen, search} = useContext(SelectContext);
  const hiddenOptions = useContext(SelectFilterContext);
  const listItems = useMemo(
    () =>
      [...listState.collection].filter(node => {
        if (node.type === 'section') {
          return ![...node.childNodes].every(child =>
            hiddenOptions.has(child.props.value)
          );
        }

        return !hiddenOptions.has(node.props.value);
      }),
    [listState.collection, hiddenOptions]
  );

  return (
    <Fragment>
      {listItems.length !== 0 && <ListSeparator role="separator" />}
      {listItems.length !== 0 && label && <ListLabel {...labelProps}>{label}</ListLabel>}
      <ListWrap {...mergeProps(listBoxProps, props)} onKeyDown={onKeyDown} ref={ref}>
        {overlayIsOpen &&
          listItems.map(item => {
            if (item.type === 'section') {
              return (
                <ListBoxSection
                  key={item.key}
                  item={item}
                  listState={listState}
                  onToggle={onSectionToggle}
                  size={size}
                />
              );
            }

            return (
              <ListBoxOption
                key={item.key}
                item={item}
                listState={listState}
                size={size}
              />
            );
          })}

        {!search && hiddenOptions.size > 0 && (
          <SizeLimitMessage>
            {sizeLimitMessage ?? t('Use search to find more options…')}
          </SizeLimitMessage>
        )}
      </ListWrap>
    </Fragment>
  );
}

export {ListBox};
