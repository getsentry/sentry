import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import DropdownAutoCompleteMenu from 'app/components/dropdownAutoCompleteMenu';

class DropdownAutoComplete extends React.Component {
  static propTypes = {
    ...DropdownAutoCompleteMenu.propTypes,

    // Should clicking the actor toggle visibility?
    allowActorToggle: PropTypes.bool,

    children: PropTypes.func,
  };

  static defaultProps = {
    alignMenu: 'right',
  };

  render() {
    const {children, allowActorToggle, ...props} = this.props;

    return (
      <DropdownAutoCompleteMenu {...props}>
        {renderProps => {
          // Don't pass `onClick` from `getActorProps`
          const {
            //eslint-disable-next-line no-unused-vars
            onClick,
            ...actorProps
          } = renderProps.getActorProps({isStyled: true});

          return (
            <Actor
              isOpen={renderProps.isOpen}
              role="button"
              onClick={
                renderProps.isOpen && allowActorToggle
                  ? renderProps.actions.close
                  : renderProps.actions.open
              }
              {...actorProps}
            >
              {children(renderProps)}
            </Actor>
          );
        }}
      </DropdownAutoCompleteMenu>
    );
  }
}

const Actor = styled('div')`
  position: relative;
  width: 100%;
  /* This is needed to be able to cover dropdown menu so that it looks like one unit */
  ${p => p.isOpen && `z-index: ${p.theme.zIndex.dropdownAutocomplete.actor}`};
`;

export default DropdownAutoComplete;
