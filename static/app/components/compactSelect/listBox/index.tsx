import {Fragment, useCallback, useContext, useRef} from 'react';
import styled from '@emotion/styled';
import {AriaListBoxOptions, useListBox} from '@react-aria/listbox';
import {mergeProps} from '@react-aria/utils';
import {ListState} from '@react-stately/list';
import {Node} from '@react-types/shared';

import {space} from 'sentry/styles/space';
import {FormSize} from 'sentry/utils/theme';

import {SelectContext} from '../control';

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

  const {overlayIsOpen} = useContext(SelectContext);
  return (
    <Fragment>
      {listItems.length !== 0 && <Separator role="separator" />}
      {listItems.length !== 0 && label && <Label {...labelProps}>{label}</Label>}
      <SelectListBoxWrap
        {...mergeProps(listBoxProps, props)}
        onKeyDown={onKeyDown}
        ref={ref}
      >
        {overlayIsOpen &&
          listItems.map(item => {
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
              <ListBoxOption
                key={item.key}
                item={item}
                listState={listState}
                size={size}
              />
            );
          })}
      </SelectListBoxWrap>
    </Fragment>
  );
}

export {ListBox};

const SelectListBoxWrap = styled('ul')`
  margin: 0;
  padding: ${space(0.5)} 0;

  /* Add 1px to top padding if preceded by menu header, to account for the header's
  shadow border */
  div[data-header] ~ &:first-of-type,
  div[data-header] ~ div > &:first-of-type {
    padding-top: calc(${space(0.5)} + 1px);
  }

  /* Remove top padding if preceded by search input, since search input already has
  vertical padding */
  input ~ &&:first-of-type,
  input ~ div > &&:first-of-type {
    padding-top: 0;
  }

  /* Should scroll if it's in a non-composite select */
  :only-of-type {
    min-height: 0;
    overflow: auto;
  }

  :focus-visible {
    outline: none;
  }
`;

const Label = styled('p')`
  display: inline-block;
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.subText};
  text-transform: uppercase;
  white-space: nowrap;
  margin: ${space(0.5)} ${space(1.5)};
  padding-right: ${space(1)};
`;

const Separator = styled('div')`
  border-top: solid 1px ${p => p.theme.innerBorder};
  margin: ${space(0.5)} ${space(1.5)};

  :first-child {
    display: none;
  }

  ul:empty + & {
    display: none;
  }
`;
