import React, {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import type {MenuProps} from './menu';
import Menu from './menu';

function makeActorProps(
  renderProps,
  options: {
    lazy: boolean;
    allowActorToggle?: boolean;
    onLazyOpen?: (fn: (e: React.MouseEvent) => void) => void;
  }
) {
  const {isOpen, actions, getActorProps} = renderProps;
  // Don't pass `onClick` from `getActorProps`
  const {onClick: _onClick, ...actorProps} = getActorProps();
  const onOpen =
    options.lazy && options.onLazyOpen ? options.onLazyOpen(actions.open) : actions.open;

  return {
    role: 'button',
    tabIndex: 0,
    isOpen,
    onClick: isOpen && options.allowActorToggle ? actions.close : onOpen,
    ...actorProps,
  };
}

interface BaseProps extends Omit<MenuProps, 'items'> {
  // Should clicking the actor toggle visibility
  allowActorToggle?: boolean;
}
interface LazyDropdownAutoCompleteProps extends BaseProps {
  lazyItems: () => MenuProps['items'];
  items?: never;
}

export interface StaticDropdownAutoCompleteProps extends BaseProps {
  items: MenuProps['items'];
  lazyItems?: never;
}

export type DropdownAutoCompleteProps =
  | LazyDropdownAutoCompleteProps
  | StaticDropdownAutoCompleteProps;

function DropdownAutoComplete(
  props: LazyDropdownAutoCompleteProps | StaticDropdownAutoCompleteProps
) {
  const {allowActorToggle, children, items, lazyItems, ...rest} = props;
  const [maybeLazyItems, setMaybeLazyItems] = useState<MenuProps['items']>(
    items ? items : null
  );

  const onLazyOpen = useCallback(
    (onActionOpen: (e: React.MouseEvent) => void) => {
      return (e: React.MouseEvent) => {
        if (typeof lazyItems !== 'function') {
          onActionOpen(e);
          return;
        }
        setMaybeLazyItems(lazyItems());
        onActionOpen(e);
      };
    },
    [lazyItems]
  );

  const isLazy = typeof props.lazyItems === 'function';

  return (
    <Menu {...rest} items={isLazy ? maybeLazyItems : items === undefined ? null : items}>
      {renderProps => (
        <Actor
          {...makeActorProps(renderProps, {lazy: isLazy, onLazyOpen, allowActorToggle})}
        >
          {children(renderProps)}
        </Actor>
      )}
    </Menu>
  );
}

const Actor = styled('div')<{isOpen: boolean}>`
  position: relative;
  width: 100%;
  /* This is needed to be able to cover dropdown menu so that it looks like one unit */
  ${p => p.isOpen && `z-index: ${p.theme.zIndex.dropdownAutocomplete.actor}`};
`;

export default DropdownAutoComplete;
