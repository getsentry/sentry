import {Fragment, useCallback, useContext, useRef} from 'react';
import styled from '@emotion/styled';
import {AriaGridListOptions, useGridList} from '@react-aria/gridlist';
import {mergeProps} from '@react-aria/utils';
import {ListState} from '@react-stately/list';
import {Node} from '@react-types/shared';

import {space} from 'sentry/styles/space';
import domId from 'sentry/utils/domId';
import {FormSize} from 'sentry/utils/theme';

import {SelectContext} from '../control';

import {GridListOption} from './option';
import {GridListSection} from './section';

interface GridListProps
  extends React.HTMLAttributes<HTMLUListElement>,
    Omit<
      AriaGridListOptions<any>,
      'disabledKeys' | 'selectedKeys' | 'defaultSelectedKeys' | 'onSelectionChange'
    > {
  /**
   * Keyboard event handler, to be attached to the list (`ul`) element, to seamlessly
   * move focus from one composite list to another when an arrow key is pressed. Returns
   * a boolean indicating whether the keyboard event was intercepted. If yes, then no
   * further callback function should be run.
   */
  keyDownHandler: (e: React.KeyboardEvent<HTMLUListElement>) => boolean;
  /**
   * Items to be rendered inside this grid list.
   */
  listItems: Node<any>[];
  /**
   * Object containing the selection state and focus position, needed for
   * `useGridList()`.
   */
  listState: ListState<any>;
  /**
   * Text label to be rendered as heading on top of grid list.
   */
  label?: React.ReactNode;
  size?: FormSize;
}

/**
 * A grid list with accessibile behaviors & attributes.
 * https://react-spectrum.adobe.com/react-aria/useGridList.html
 *
 * Unlike list boxes, grid lists are two-dimensional. Users can press Arrow Up/Down to
 * move between rows (options), and Arrow Left/Right to move between "columns". This is
 * useful when the select options have smaller, interactive elements (buttons/links)
 * inside. Grid lists allow users to focus on those child elements (using the Arrow
 * Left/Right keys) and interact with them, which isn't possible with list boxes.
 */
function GridList({
  listItems,
  listState,
  size = 'md',
  label,
  keyDownHandler,
  ...props
}: GridListProps) {
  const ref = useRef<HTMLUListElement>(null);
  const labelId = domId('grid-label-');
  const {gridProps} = useGridList(
    {...props, 'aria-labelledby': label ? labelId : props['aria-labelledby']},
    listState,
    ref
  );

  const onKeyDown = useCallback<React.KeyboardEventHandler<HTMLUListElement>>(
    e => {
      const continueCallback = keyDownHandler?.(e);
      // Prevent grid list from clearing value on Escape key press
      continueCallback && e.key !== 'Escape' && gridProps.onKeyDown?.(e);
    },
    [keyDownHandler, gridProps]
  );

  const {overlayIsOpen} = useContext(SelectContext);
  return (
    <Fragment>
      {listItems.length !== 0 && <Separator role="separator" />}
      {listItems.length !== 0 && label && <Label id={labelId}>{label}</Label>}
      <SelectGridListWrap
        {...mergeProps(gridProps, props)}
        onKeyDown={onKeyDown}
        ref={ref}
      >
        {overlayIsOpen &&
          listItems.map(item => {
            if (item.type === 'section') {
              return (
                <GridListSection
                  key={item.key}
                  node={item}
                  listState={listState}
                  size={size}
                />
              );
            }

            return (
              <GridListOption
                key={item.key}
                node={item}
                listState={listState}
                size={size}
              />
            );
          })}
      </SelectGridListWrap>
    </Fragment>
  );
}

export {GridList};

const SelectGridListWrap = styled('ul')`
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
