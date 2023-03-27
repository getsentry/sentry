import {Fragment, useCallback, useRef} from 'react';
import {AriaListBoxOptions, useListBox} from '@react-aria/listbox';
import {mergeProps} from '@react-aria/utils';
import {ListState} from '@react-stately/list';
import {Node} from '@react-types/shared';

import {FormSize} from 'sentry/utils/theme';

import {ListLabel, ListSeparator, ListWrap} from '../styles';

import {ListBoxOption} from './option';
import {ListBoxSection} from './section';

interface ListBoxProps
  extends Omit<React.HTMLAttributes<HTMLUListElement>, 'onBlur' | 'onFocus'>,
    Omit<
      AriaListBoxOptions<any>,
      | 'children'
      | 'items'
      | 'disabledKeys'
      | 'selectedKeys'
      | 'defaultSelectedKeys'
      | 'onSelectionChange'
    > {
  /**
   * Keyboard event handler, to be attached to the list (`ul`) element, to seamlessly
   * move focus from one composite list to another when an arrow key is pressed. Returns
   * a boolean indicating whether the keyboard event was intercepted. If yes, then no
   * further callback function should be run.
   */
  keyDownHandler: (e: React.KeyboardEvent<HTMLUListElement>) => boolean;
  /**
   * Items to be rendered inside this list box.
   */
  listItems: Node<any>[];
  /**
   * Object containing the selection state and focus position, needed for
   * `useListBox()`.
   */
  listState: ListState<any>;
  /**
   * Text label to be rendered as heading on top of grid list.
   */
  label?: React.ReactNode;
  size?: FormSize;
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
  listItems,
  listState,
  size = 'md',
  shouldFocusWrap = true,
  shouldFocusOnHover = true,
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

  return (
    <Fragment>
      {listItems.length !== 0 && <ListSeparator role="separator" />}
      {listItems.length !== 0 && label && <ListLabel {...labelProps}>{label}</ListLabel>}
      <ListWrap {...mergeProps(listBoxProps, props)} onKeyDown={onKeyDown} ref={ref}>
        {listItems.map(item => {
          if (item.type === 'section') {
            return (
              <ListBoxSection
                key={item.key}
                item={item}
                listState={listState}
                size={size}
              />
            );
          }

          return (
            <ListBoxOption key={item.key} item={item} listState={listState} size={size} />
          );
        })}
      </ListWrap>
    </Fragment>
  );
}

export {ListBox};
