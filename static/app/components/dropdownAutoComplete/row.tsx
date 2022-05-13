import {memo, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import AutoComplete from 'sentry/components/autoComplete';
import space from 'sentry/styles/space';

import {Item} from './types';

type ItemSize = 'zero' | 'small';
type AutoCompleteChildrenArgs<T> = Parameters<AutoComplete<T>['props']['children']>[0];

type Props<T> = Pick<
  AutoCompleteChildrenArgs<T>,
  'getItemProps' | 'registerVisibleItem' | 'inputValue'
> &
  Omit<Parameters<AutoCompleteChildrenArgs<T>['getItemProps']>[0], 'index'> & {
    /**
     * Is the row 'active'
     */
    isHighlighted: boolean;
    /**
     * Size for dropdown items
     */
    itemSize?: ItemSize;
    /**
     * Style is used by react-virtualized for alignment
     */
    style?: React.CSSProperties;
  };

function scrollIntoView(element: HTMLDivElement) {
  element?.scrollIntoView?.({block: 'nearest'});
}

function Row<T extends Item>({
  item,
  style,
  itemSize,
  isHighlighted,
  inputValue,
  getItemProps,
  registerVisibleItem,
}: Props<T>) {
  const {index} = item;

  useEffect(() => registerVisibleItem(item.index, item), [registerVisibleItem, item]);

  const itemProps = useMemo(
    () => getItemProps({item, index}),
    [getItemProps, item, index]
  );

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
      isHighlighted={isHighlighted}
      style={style}
      ref={isHighlighted ? scrollIntoView : undefined}
      {...itemProps}
    >
      {typeof item.label === 'function' ? item.label({inputValue}) : item.label}
    </AutoCompleteItem>
  );
}

// XXX(epurkhiser): We memoize the row component since there will be many of
// them, we do not want them re-rendering every time we change the
// highlightedIndex in the parent List.

export default memo(Row);

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
  scroll-margin: 20px 0;

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
