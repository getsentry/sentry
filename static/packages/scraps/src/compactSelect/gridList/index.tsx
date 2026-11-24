import type * as React from 'react';
import {useContext, useId, useMemo, useRef, useState} from 'react';
import type {AriaGridListOptions} from '@react-aria/gridlist';
import {useGridList} from '@react-aria/gridlist';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {CollectionChildren} from '@react-types/shared';

import {SelectFilterContext} from '@sentry/scraps/compactSelect/selectFilterContext';
import {SelectRows} from '@sentry/scraps/compactSelect/selectRows';
import {
  ListLabel,
  ListSeparator,
  ListScrollArea,
  ListWrap,
  SizeLimitMessage,
} from '@sentry/scraps/compactSelect/styles';
import type {ListItemBase} from '@sentry/scraps/compactSelect/types';
import {
  getVisibleListItems,
  getVisibleOptionPositions,
  hasVisibleLeadingItems,
} from '@sentry/scraps/compactSelect/utils';
import {ControlContext, ReserveLeadingSlot} from '@sentry/scraps/menu';
import {useTranslation} from '@sentry/scraps/translation';

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
  const ref = useRef<HTMLUListElement>(null);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
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
    () => getVisibleListItems(listState.collection, hiddenOptions),
    [listState.collection, hiddenOptions]
  );
  const reserveLeadingSlot = useMemo(
    () => hasVisibleLeadingItems(listItems, hiddenOptions),
    [listItems, hiddenOptions]
  );
  // Screen readers cannot count the rows of a virtualized grid from the DOM.
  const rowCount = virtualized
    ? getVisibleOptionPositions(listItems, hiddenOptions).size
    : undefined;

  const mergedProps = mergeProps(gridProps, props);

  return (
    <ReserveLeadingSlot reserve={reserveLeadingSlot}>
      {listItems.length !== 0 && <ListSeparator role="separator" />}
      {listItems.length !== 0 && label && <ListLabel id={labelId}>{label}</ListLabel>}
      {overlayIsOpen && (
        <ListScrollArea
          data-test-id="select-scroll-area"
          ref={setScrollElement}
          overflowY="auto"
        >
          <ListWrap
            {...mergedProps}
            aria-rowcount={rowCount}
            aria-colcount={rowCount === undefined ? undefined : 1}
            onKeyDown={onKeyDown}
            ref={ref}
          >
            <SelectRows
              listItems={listItems}
              listRef={ref}
              hiddenOptions={hiddenOptions}
              virtualized={!!virtualized}
              size={size}
              scrollElement={scrollElement}
              selectionManager={listState.selectionManager}
              showSectionHeaders
              renderOption={({node, position, rowProps}) => (
                <GridListOption
                  node={node}
                  listState={listState}
                  rowIndex={position?.rowIndex}
                  size={size}
                  data-index={rowProps?.['data-index']}
                  ref={rowProps?.ref}
                />
              )}
              renderSection={(section, options) => (
                <GridListSection section={section} listState={listState}>
                  {options}
                </GridListSection>
              )}
            />

            {!searchable && hiddenOptions.size > 0 && (
              <SizeLimitMessage>
                {sizeLimitMessage ?? t('Use search to find more options…')}
              </SizeLimitMessage>
            )}
          </ListWrap>
        </ListScrollArea>
      )}
    </ReserveLeadingSlot>
  );
}

export {GridList};
