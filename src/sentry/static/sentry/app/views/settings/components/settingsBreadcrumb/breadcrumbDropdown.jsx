import PropTypes from 'prop-types';
import React from 'react';

import Crumb from './crumb';
import DropdownAutoCompleteMenu from '../../../../components/dropdownAutoCompleteMenu';
import Divider from './divider';

class BreadcrumbDropdown extends React.Component {
  static propTypes = {
    hasMenu: PropTypes.bool,
    route: PropTypes.object,
    isLast: PropTypes.bool,
    enterDelay: PropTypes.number,
    name: PropTypes.node,
    items: PropTypes.array,
    onSelect: PropTypes.func,
  };

  static defaultProps = {
    enterDelay: 200,
  };

  constructor(...args) {
    super(...args);

    this.entering = false;
    this.leaving = false;
  }

  // Adds a delay when mouse hovers on actor (in this case the breadcrumb)
  handleMouseEnterActor = (actions, e) => {
    if (this.leaving) {
      clearTimeout(this.leaving);
    }

    this.entering = setTimeout(() => actions.open(), this.props.enterDelay);
  };

  // handles mouseEnter event on actor and menu, should clear the leaving timeout and keep menu open
  handleMouseEnter = (actions, e) => {
    if (this.leaving) {
      clearTimeout(this.leaving);
    }

    actions.open();
  };

  // handles mouseLeave event on actor and menu, adds a timeout before updating state to account for
  // mouseLeave into
  handleMouseLeave = (actions, e) => {
    if (this.entering) {
      clearTimeout(this.entering);
    }

    this.leaving = setTimeout(() => actions.open(), 200);
  };

  // Close immediately when actor is clicked clicked
  handleClickActor = (actions, e) => {
    actions.close();
  };

  // Close immediately when clicked outside
  handleClose = actions => {
    actions.close();
  };

  render() {
    let {hasMenu, route, isLast, name, items, onSelect} = this.props;
    return (
      <DropdownAutoCompleteMenu items={items} onSelect={onSelect} isStyled>
        {({actions, isOpen}) => {
          return (
            <Crumb hasMenu={hasMenu}>
              <div
                onClick={this.handleClickActor.bind(this, actions)}
                onMouseEnter={this.handleMouseEnterActor.bind(this, actions)}
                onMouseLeave={this.handleMouseLeave.bind(this, actions)}
                style={{display: 'inline'}}
              >
                {name || route.name}{' '}
              </div>
              <Divider isHover={hasMenu && isOpen} isLast={isLast} />
            </Crumb>
          );
        }}
      </DropdownAutoCompleteMenu>
    );
  }
}

export default BreadcrumbDropdown;
