import styled from '@emotion/styled';

import AutoComplete from 'sentry/components/autoComplete';
import space from 'sentry/styles/space';

import {Item} from './types';

type ItemSize = 'zero' | 'small';
type AutoCompleteChildrenArgs<T> = Parameters<AutoComplete<T>['props']['children']>[0];

type Props<T> = Pick<
  AutoCompleteChildrenArgs<T>,
  'highlightedIndex' | 'getItemProps' | 'inputValue'
> &
  Omit<Parameters<AutoCompleteChildrenArgs<T>['getItemProps']>[0], 'index'> & {
    /**
     * Size for dropdown items
     */
    itemSize?: ItemSize;
  };

function Row<T extends Item>({
  item,
  style,
  itemSize,
  highlightedIndex,
  inputValue,
  getItemProps,
}: Props<T>) {
  const {index} = item;

  if (item.groupLabel) {
    return (
      <LabelWithBorder style={style}>
        {item.label && <GroupLabel>{item.label}</GroupLabel>}
      </LabelWithBorder>
    );
  }

  return (
    <AutoCompleteItem
      itemSize={itemSize}
      disabled={item.disabled}
      isHighlighted={index === highlightedIndex}
      {...getItemProps({item, index, style})}
    >
      {typeof item.label === 'function' ? item.label({inputValue}) : item.label}
    </AutoCompleteItem>
  );
}

export default Row;

const getItemPaddingForSize = (itemSize?: ItemSize) => {
  if (itemSize === 'small') {
    return `${space(0.5)} ${space(1)}`;
  }

  if (itemSize === 'zero') {
    return '0';
  }

  return space(1);
};

const LabelWithBorder = styled('div')`
  background-color: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  border-width: 1px 0;
  color: ${p => p.theme.subText};
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

const AutoCompleteItem = styled('div')<{
  isHighlighted: boolean;
  disabled?: boolean;
  itemSize?: ItemSize;
}>`
  position: relative;
  /* needed for virtualized lists that do not fill parent height */
  /* e.g. breadcrumbs (org height > project, but want same fixed height for both) */
  display: flex;
  flex-direction: column;
  justify-content: center;

  font-size: ${p => p.theme.fontSizeMedium};
  background-color: ${p => (p.isHighlighted ? p.theme.hover : 'transparent')};
  color: ${p => (p.isHighlighted ? p.theme.textColor : 'inherit')};
  padding: ${p => getItemPaddingForSize(p.itemSize)};
  cursor: ${p => (p.disabled ? 'not-allowed' : 'pointer')};
  border-bottom: 1px solid ${p => p.theme.innerBorder};

  :last-child {
    border-bottom: none;
  }

  :hover {
    color: ${p => p.theme.textColor};
    background-color: ${p => p.theme.hover};
  }
`;
