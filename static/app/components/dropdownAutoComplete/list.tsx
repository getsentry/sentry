import {Fragment} from 'react';
import {AutoSizer, List as ReactVirtualizedList} from 'react-virtualized';

import Row from './row';
import type {ItemsAfterFilter} from './types';

type RowProps = Pick<
  React.ComponentProps<typeof Row>,
  'itemSize' | 'getItemProps' | 'registerVisibleItem'
>;

type Props = {
  /**
   * The item index that is currently isActive
   */
  highlightedIndex: number;
  /**
   * Flat item array or grouped item array
   */
  items: ItemsAfterFilter;
  /**
   * Max height of dropdown menu. Units are assumed as `px`
   */
  maxHeight: number;
  /**
   * Callback for when dropdown menu is being scrolled
   */
  onScroll?: () => void;
  /**
   * Supplying this height will force the dropdown menu to be a virtualized
   * list. This is very useful (and probably required) if you have a large list.
   * e.g. Project selector with many projects.
   *
   * Currently, our implementation of the virtualized list requires a fixed
   * height.
   */
  virtualizedHeight?: number;
  /**
   * If you use grouping with virtualizedHeight, the labels will be that height
   * unless specified here
   */
  virtualizedLabelHeight?: number;
} & RowProps;

function getHeight(
  items: ItemsAfterFilter,
  maxHeight: number,
  virtualizedHeight: number,
  virtualizedLabelHeight?: number
) {
  const minHeight = virtualizedLabelHeight
    ? items.reduce(
        (a, r) => a + (r.groupLabel ? virtualizedLabelHeight : virtualizedHeight),
        0
      )
    : items.length * virtualizedHeight;
  return Math.min(minHeight, maxHeight);
}

function List({
  virtualizedHeight,
  virtualizedLabelHeight,
  onScroll,
  items,
  highlightedIndex,
  maxHeight,
  ...rowProps
}: Props) {
  if (virtualizedHeight) {
    return (
      <AutoSizer disableHeight>
        {({width}) => (
          <ReactVirtualizedList
            style={{outline: 'none'}}
            width={width}
            height={getHeight(
              items,
              maxHeight,
              virtualizedHeight,
              virtualizedLabelHeight
            )}
            onScroll={onScroll}
            rowCount={items.length}
            rowHeight={({index}) =>
              items[index]!.groupLabel && virtualizedLabelHeight
                ? virtualizedLabelHeight
                : virtualizedHeight
            }
            rowRenderer={({key, index, style}) => (
              <Row
                key={key}
                style={style}
                item={items[index]!}
                isHighlighted={items[index]!.index === highlightedIndex}
                {...rowProps}
              />
            )}
          />
        )}
      </AutoSizer>
    );
  }

  return (
    <Fragment>
      {items.map((item, index) => (
        <Row
          // Using only the index of the row might not re-render properly,
          // because the items shift around the list
          key={`${item.value}-${index}`}
          item={item}
          isHighlighted={item.index === highlightedIndex}
          {...rowProps}
        />
      ))}
    </Fragment>
  );
}

export default List;
