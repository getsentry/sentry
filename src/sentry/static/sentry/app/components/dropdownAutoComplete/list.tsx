import React from 'react';
import styled from '@emotion/styled';
import {AutoSizer, List as ReactVirtualizedList, ListRowProps} from 'react-virtualized';

import {ItemsAfterFilter} from './types';
import Row from './row';

type RowProps = Pick<
  React.ComponentProps<typeof Row>,
  'itemSize' | 'highlightedIndex' | 'inputValue' | 'getItemProps'
>;

type Props = {
  // flat item array | grouped item array
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
   * If you use grouping with virtualizedHeight, the labels will be that height unless specified here
   */
  virtualizedLabelHeight?: number;

  /**
   * Supplying this height will force the dropdown menu to be a virtualized list.
   * This is very useful (and probably required) if you have a large list. e.g. Project selector with many projects.
   *
   * Currently, our implementation of the virtualized list requires a fixed height.
   */
  virtualizedHeight?: number;
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

const List = ({
  virtualizedHeight,
  virtualizedLabelHeight,
  onScroll,
  items,
  itemSize,
  highlightedIndex,
  inputValue,
  getItemProps,
  maxHeight,
}: Props) => {
  if (virtualizedHeight) {
    return (
      <AutoSizer disableHeight>
        {({width}) => (
          <StyledList
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
              items[index].groupLabel && virtualizedLabelHeight
                ? virtualizedLabelHeight
                : virtualizedHeight
            }
            rowRenderer={({key, index, style}: ListRowProps) => (
              <Row
                key={key}
                item={items[index]}
                style={style}
                itemSize={itemSize}
                highlightedIndex={highlightedIndex}
                inputValue={inputValue}
                getItemProps={getItemProps}
              />
            )}
          />
        )}
      </AutoSizer>
    );
  }

  return (
    <React.Fragment>
      {items.map((item, index) => (
        <Row
          // Using only the index of the row might not re-render properly,
          // because the items shift around the list
          key={`${item.value}-${index}`}
          item={item}
          itemSize={itemSize}
          highlightedIndex={highlightedIndex}
          inputValue={inputValue}
          getItemProps={getItemProps}
        />
      ))}
    </React.Fragment>
  );
};

export default List;

const StyledList = styled(ReactVirtualizedList)`
  outline: none;
`;
