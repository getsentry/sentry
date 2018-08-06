import PropTypes from 'prop-types';
import React from 'react';

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
            <div role="button" onClick={renderProps.actions.open} {...actorProps}>
              {children(renderProps)}
            </div>
          );
        }}
      </DropdownAutoCompleteMenu>
    );
  }
}

export default DropdownAutoComplete;
