import {Fragment, useContext, useEffect, useId, useMemo, useRef} from 'react';
import type {AriaGridListOptions} from '@react-aria/gridlist';
import {useGridList} from '@react-aria/gridlist';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {CollectionChildren} from '@react-types/shared';

import {
  ControlContext,
  ListLabel,
  ListSeparator,
  ListWrap,
  type SelectKey,
  SelectFilterContext,
  SizeLimitMessage,
  useVirtualizedItems,
} from '@sentry/scraps/compactSelect';
import type {ListItemBase} from '@sentry/scraps/compactSelect/types';
import {Container} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';

import {GridListOption, type GridListOptionProps} from './option';
import {GridListSection} from './section';

interface GridListProps<T extends ListItemBase>
  extends
    Omit<React.HTMLAttributes<HTMLUListElement>, 'children'>,
    Omit<
      AriaGridListOptions<any>,
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
   * `useGridList()`.
   */
  listState: ListState<T>;
  children?: CollectionChildren<T>;
  /**
   * Text label to be rendered as heading on top of grid list.
   */
  label?: React.ReactNode;
  searchFocusedId?: string;
  searchFocusedKey?: SelectKey | null;
  size?: GridListOptionProps<ListItemBase>['size'];
  /**
   * Message to be displayed when some options are hidden due to `sizeLimit`.
   */
  sizeLimitMessage?: string;
  /**
   * If true, virtualization will be enabled for the list.
   */
  virtualized?: boolean;
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
function GridList<T extends ListItemBase>({
  listState,
  size = 'md',
  label,
  sizeLimitMessage,
  keyDownHandler,
  virtualized,
  searchFocusedId,
  searchFocusedKey,
  ...props
}: GridListProps<T>) {
  const ref = useRef<HTMLUListElement>(null);
  const labelId = useId();
  const {gridProps} = useGridList(
    {...props, 'aria-labelledby': label ? labelId : props['aria-labelledby']},
    listState,
    ref
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const continueCallback = keyDownHandler?.(e);
    // Prevent grid list from clearing value on Escape key press
    if (continueCallback && e.key !== 'Escape') {
      gridProps.onKeyDown?.(e);
    }
  };

  const {overlayIsOpen, searchable} = useContext(ControlContext);
  const hiddenOptions = useContext(SelectFilterContext);
  const listItems = useMemo(
    () =>
      [...listState.collection].filter(node => {
        if (node.type === 'section') {
          return ![...node.childNodes].every(child => hiddenOptions.has(child.key));
        }

        return !hiddenOptions.has(node.key);
      }),
    [listState.collection, hiddenOptions]
  );

  const virtualizer = useVirtualizedItems({
    listItems,
    virtualized,
    size,
  });

  // Keep the virtually focused row mounted. When focus stays in the search input,
  // `searchFocusedKey` drives aria-activedescendant and the referenced row must be
  // rendered even if the user previously scrolled it out of the virtualized range.
  useEffect(() => {
    const focusedKey = searchFocusedKey ?? listState.selectionManager.focusedKey;
    if (!virtualized || focusedKey === null) {
      return;
    }

    const focusedIndex = listItems.findIndex(item => item.key === focusedKey);
    if (focusedIndex !== -1) {
      virtualizer.scrollToIndex(focusedIndex);
    }
  }, [
    virtualized,
    listItems,
    listState.selectionManager.focusedKey,
    searchFocusedKey,
    virtualizer,
  ]);

  const mergedProps = mergeProps(gridProps, props);

  return (
    <Fragment>
      {listItems.length !== 0 && <ListSeparator role="separator" />}
      {listItems.length !== 0 && label && <ListLabel id={labelId}>{label}</ListLabel>}
      {overlayIsOpen && (
        <Container ref={virtualizer.scrollElementRef} height="100%" overflowY="auto">
          <Container {...virtualizer.wrapperProps}>
            <ListWrap
              {...mergedProps}
              style={{...mergedProps.style, ...virtualizer.listWrapStyle}}
              onKeyDown={onKeyDown}
              ref={ref}
            >
              {virtualizer.items.map(row => {
                const item = listItems[row.index];
                if (!item) {
                  return null;
                }
                if (item.type === 'section') {
                  return (
                    <GridListSection
                      {...virtualizer.itemProps(row.index)}
                      key={item.key}
                      node={item}
                      listState={listState}
                      searchFocusedId={searchFocusedId}
                      searchFocusedKey={searchFocusedKey}
                      size={size}
                    />
                  );
                }

                return (
                  <GridListOption
                    key={item.key}
                    {...virtualizer.itemProps(row.index)}
                    node={item}
                    listState={listState}
                    size={size}
                    forceFocused={item.key === searchFocusedKey}
                    searchFocusedId={searchFocusedId}
                  />
                );
              })}

              {!searchable && hiddenOptions.size > 0 && (
                <SizeLimitMessage>
                  {sizeLimitMessage ?? t('Use search to find more options…')}
                </SizeLimitMessage>
              )}
            </ListWrap>
          </Container>
        </Container>
      )}
    </Fragment>
  );
}

export {GridList};
