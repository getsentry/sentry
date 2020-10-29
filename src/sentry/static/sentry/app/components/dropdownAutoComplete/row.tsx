import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

import {GetItemArgs} from './types';

type ItemSize = 'zero' | 'small';

type Props = {
  // The highlight index according the search
  highlightedIndex: number;
  getItemProps: (args: GetItemArgs) => void;
  /**
   * Search field's input value
   */
  inputValue: string;

  /**
   * Size for dropdown items
   */
  itemSize?: ItemSize;
} & Omit<GetItemArgs, 'index'>;

const Row = ({
  item,
  style,
  itemSize,
  highlightedIndex,
  inputValue,
  getItemProps,
}: Props) => {
  const {index} = item;

  if (item?.groupLabel) {
    return (
      <LabelWithBorder style={style}>
        {item.label && <GroupLabel>{item.label}</GroupLabel>}
      </LabelWithBorder>
    );
  }

  return (
    <AutoCompleteItem
      itemSize={itemSize}
      hasGrayBackground={index === highlightedIndex}
      {...getItemProps({item, index, style})}
    >
      {typeof item.label === 'function' ? item.label({inputValue}) : item.label}
    </AutoCompleteItem>
  );
};

export default Row;

const LabelWithBorder = styled('div')`
  background-color: ${p => p.theme.gray100};
  border-bottom: 1px solid ${p => p.theme.borderLight};
  border-width: 1px 0;
  color: ${p => p.theme.gray600};
  font-size: ${p => p.theme.fontSizeMedium};

  :first-child {
    border-top: none;
  }
  :last-child {
    border-bottom: none;
  }
`;

const GroupLabel = styled('div')`
  padding: ${space(0.25)} ${space(1)};
`;

const getItemPaddingForSize = (itemSize?: ItemSize) => {
  if (itemSize === 'small') {
    return `${space(0.5)} ${space(1)}`;
  }

  if (itemSize === 'zero') {
    return '0';
  }

  return space(1);
};

const AutoCompleteItem = styled('div')<{hasGrayBackground: boolean; itemSize?: ItemSize}>`
  /* needed for virtualized lists that do not fill parent height */
  /* e.g. breadcrumbs (org height > project, but want same fixed height for both) */
  display: flex;
  flex-direction: column;
  justify-content: center;

  font-size: 0.9em;
  background-color: ${p => (p.hasGrayBackground ? p.theme.gray100 : 'transparent')};
  padding: ${p => getItemPaddingForSize(p.itemSize)};
  cursor: pointer;
  border-bottom: 1px solid ${p => p.theme.borderLight};

  :last-child {
    border-bottom: none;
  }

  :hover {
    background-color: ${p => p.theme.gray100};
  }
`;
