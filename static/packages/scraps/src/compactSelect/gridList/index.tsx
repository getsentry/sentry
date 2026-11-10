import type * as React from 'react';
import {useContext, useId, useMemo, useRef} from 'react';
import {useTheme} from '@emotion/react';
import type {AriaGridListOptions} from '@react-aria/gridlist';
import {useGridList} from '@react-aria/gridlist';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {CollectionChildren} from '@react-types/shared';

import {SelectFilterContext} from '@sentry/scraps/compactSelect/selectFilterContext';
import {
  ListLabel,
  ListSeparator,
  ListWrap,
  SizeLimitMessage,
} from '@sentry/scraps/compactSelect/styles';
import type {ListItemBase, SelectKey} from '@sentry/scraps/compactSelect/types';
import {
  getVisibleOptionPositions,
  hasVisibleLeadingItems,
} from '@sentry/scraps/compactSelect/utils';
import {Container} from '@sentry/scraps/layout';
import {ControlContext, ReserveLeadingSlot} from '@sentry/scraps/menu';
import {useTranslation} from '@sentry/scraps/translation';
import {
  useVirtualCollection,
  VirtualRows,
  type VirtualRowProps,
} from '@sentry/scraps/useVirtualCollection';

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

interface GridListRowProps<T extends ListItemBase> extends Pick<
  GridListOptionProps<T>,
  'listState' | 'node' | 'rowIndex' | 'size'
> {
  virtualIndex?: number;
  virtualRef?: VirtualRowProps['ref'];
}

/**
 * Renders an option for `VirtualRows`. The list re-renders on every scroll, so
 * this returns the same option element while the row's own props keep their
 * identity, and React skips rendering an option that did not change.
 */
// Props are listed rather than spread: a rest object is new on every render.
function GridListRow<T extends ListItemBase>({
  listState,
  node,
  rowIndex,
  size,
  virtualIndex,
  virtualRef,
}: GridListRowProps<T>) {
  return (
    <GridListOption
      listState={listState}
      node={node}
      rowIndex={rowIndex}
      size={size}
      data-index={virtualIndex}
      ref={virtualRef}
    />
  );
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
  ...props
}: GridListProps<T>) {
  const {t} = useTranslation();
  const theme = useTheme();
  const ref = useRef<HTMLUListElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
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
  const reserveLeadingSlot = useMemo(
    () => hasVisibleLeadingItems(listItems, hiddenOptions),
    [listItems, hiddenOptions]
  );
  const positions = useMemo(
    () => (virtualized ? getVisibleOptionPositions(listItems, hiddenOptions) : undefined),
    [virtualized, listItems, hiddenOptions]
  );

  const virtual = useVirtualCollection({
    collection: listItems,
    hiddenKeys: hiddenOptions,
    enabled: !!virtualized,
    size,
    scrollRef,
    focusedKey: listState.selectionManager.focusedKey,
    // Matches the vertical padding of `ListWrap`.
    listPadding: parseFloat(theme.space.xs),
  });

  const mergedProps = mergeProps(gridProps, props);

  return (
    <ReserveLeadingSlot reserve={reserveLeadingSlot}>
      {listItems.length !== 0 && <ListSeparator role="separator" />}
      {listItems.length !== 0 && label && <ListLabel id={labelId}>{label}</ListLabel>}
      {overlayIsOpen && (
        <Container ref={scrollRef} height="100%" overflowY="auto">
          <ListWrap
            {...mergedProps}
            aria-rowcount={positions?.size}
            aria-colcount={positions ? 1 : undefined}
            onKeyDown={onKeyDown}
            ref={ref}
          >
            <VirtualRows
              virtual={virtual}
              renderRow={({node, props: rowProps}) => (
                <GridListRow
                  virtualIndex={rowProps?.['data-index']}
                  virtualRef={rowProps?.ref}
                  node={node}
                  rowIndex={positions?.get(node.key as SelectKey)?.rowIndex}
                  listState={listState}
                  size={size}
                />
              )}
              renderSection={(section, rows) => (
                <GridListSection
                  rowProps={section.props}
                  node={section.node}
                  listState={listState}
                  showSeparator={section.node.key !== listItems[0]?.key}
                >
                  {rows}
                </GridListSection>
              )}
            />

            {!searchable && hiddenOptions.size > 0 && (
              <SizeLimitMessage>
                {sizeLimitMessage ?? t('Use search to find more options…')}
              </SizeLimitMessage>
            )}
          </ListWrap>
        </Container>
      )}
    </ReserveLeadingSlot>
  );
}

export {GridList};
