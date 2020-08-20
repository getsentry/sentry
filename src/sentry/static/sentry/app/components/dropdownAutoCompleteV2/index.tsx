import React from 'react';
import styled from '@emotion/styled';

import Dropdown from './dropdown';

type MenuProps = React.ComponentProps<typeof Dropdown>;

type Props = MenuProps & {
  // Should clicking the actor toggle visibility?
  allowActorToggle?: boolean;
};

const DropdownAutoComplete = ({
  alignMenu = 'right',
  allowActorToggle = false,
  children,
  ...props
}: Props) => (
  <Dropdown {...props} alignMenu={alignMenu}>
    {renderProps => {
      const {isOpen, actions, getActorProps} = renderProps;
      // Don't pass `onClick` from `getActorProps`
      const {onClick: _onClick, ...actorProps} = getActorProps();
      return (
        <Actor
          isOpen={isOpen}
          role="button"
          tabIndex={0}
          onClick={isOpen && allowActorToggle ? actions.close : actions.open}
          {...actorProps}
        >
          {children(renderProps)}
        </Actor>
      );
    }}
  </Dropdown>
);

const Actor = styled('div')<{isOpen: boolean}>`
  position: relative;
  width: 100%;
  /* This is needed to be able to cover dropdown menu so that it looks like one unit */
  ${p => p.isOpen && `z-index: ${p.theme.zIndex.dropdownAutocomplete.actor}`};
`;

export default DropdownAutoComplete;
