import {Fragment, useCallback, useRef} from 'react';
import {AriaGridListOptions, useGridList} from '@react-aria/gridlist';
import {mergeProps} from '@react-aria/utils';
import {ListState} from '@react-stately/list';
import {Node} from '@react-types/shared';

import domId from 'sentry/utils/domId';
import {FormSize} from 'sentry/utils/theme';

import {ListLabel, ListSeparator, ListWrap} from '../styles';

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

  return (
    <Fragment>
      {listItems.length !== 0 && <ListSeparator role="separator" />}
      {listItems.length !== 0 && label && <ListLabel id={labelId}>{label}</ListLabel>}
      <ListWrap {...mergeProps(gridProps, props)} onKeyDown={onKeyDown} ref={ref}>
        {listItems.map(item => {
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
      </ListWrap>
    </Fragment>
  );
}

export {GridList};
