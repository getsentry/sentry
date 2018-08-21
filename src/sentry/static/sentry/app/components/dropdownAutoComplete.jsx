import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import DropdownAutoCompleteMenu from 'app/components/dropdownAutoCompleteMenu';

class DropdownAutoComplete extends React.Component {
  static propTypes = {
    ...DropdownAutoCompleteMenu.propTypes,
    children: PropTypes.func,
  };

  static defaultProps = {
    alignMenu: 'right',
  };

  render() {
    let {children, ...props} = this.props;

    return (
      <DropdownAutoCompleteMenu {...props}>
        {renderProps => {
          // Don't pass `onClick` from `getActorProps`
          let {
            //eslint-disable-next-line no-unused-vars
            onClick,
            ...actorProps
          } = renderProps.getActorProps();

          return (
            <Actor
              isOpen={renderProps.isOpen}
              role="button"
              onClick={renderProps.actions.open}
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
  /* This is needed to be able to cover dropdown menu so that it looks like one unit */
  ${p => p.isOpen && `z-index: ${p.theme.zIndex.dropdownAutocomplete.actor}`};
`;

export default DropdownAutoComplete;
