import React from 'react';
import {AutoSizer, List as ReactVirtualizedList, ListRowProps} from 'react-virtualized';

import {Item, ItemSize} from './types';
import Row from './row';
import {getHeight} from './utils';

type GetItemArgs = {item: Item; index: number; style?: React.CSSProperties};

type Props = {
  // flat item array | grouped item array
  items: Array<Item>;

  /**
   * Max height of dropdown menu. Units are assumed as `px`
   */
  maxHeight?: number;

  // The highlight index according the search
  highlightedIndex: number;
  getItemProps: (args: GetItemArgs) => void;

  /**
   * Search field's input value
   */
  inputValue: string;

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

  /**
   * Size for dropdown items
   */
  itemSize?: ItemSize;
};

const List = ({
  virtualizedHeight,
  virtualizedLabelHeight: _virtualizedLabelHeight,
  maxHeight,
  onScroll,
  items,
  itemSize,
  highlightedIndex,
  inputValue,
  getItemProps,
  ...props
}: Props) => {
  if (virtualizedHeight && maxHeight) {
    return (
      <AutoSizer disableHeight>
        {({width}) => (
          <ReactVirtualizedList
            width={width}
            style={{outline: 'none'}}
            height={getHeight(
              items,
              maxHeight,
              virtualizedHeight
              // virtualizedLabelHeight
            )}
            onScroll={onScroll}
            rowCount={items.length}
            rowHeight={
              virtualizedHeight
              // items[index].groupLabel && virtualizedLabelHeight
              //   ? virtualizedLabelHeight
              //   : virtualizedHeight
            }
            rowRenderer={({key, index, style}: ListRowProps) => (
              <Row
                key={key}
                item={items[index]}
                index={index}
                style={style}
                itemSize={itemSize}
                highlightedIndex={highlightedIndex}
                inputValue={inputValue}
                getItemProps={getItemProps}
                {...props}
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
          key={item.value}
          item={item}
          index={index}
          itemSize={itemSize}
          highlightedIndex={highlightedIndex}
          inputValue={inputValue}
          getItemProps={getItemProps}
          {...props}
        />
      ))}
    </React.Fragment>
  );
};

export default List;
