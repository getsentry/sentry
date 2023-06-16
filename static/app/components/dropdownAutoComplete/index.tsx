import styled from '@emotion/styled';

import Menu from './menu';

type MenuProps = React.ComponentProps<typeof Menu>;

type Props = {
  // Should clicking the actor toggle visibility
  allowActorToggle?: boolean;
} & MenuProps;

function DropdownAutoComplete({allowActorToggle = false, children, ...props}: Props) {
  return (
    <Menu {...props}>
      {renderProps => {
        const {isOpen, actions, getActorProps} = renderProps;
        // Don't pass `onClick` from `getActorProps`
        const {onClick: _onClick, ...actorProps} = getActorProps<HTMLDivElement>();
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
