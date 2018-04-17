import PropTypes from 'prop-types';
import React from 'react';

import Crumb from './crumb';
import DropdownAutoCompleteMenu from '../../../../components/dropdownAutoCompleteMenu';
import Divider from './divider';

const EXIT_DELAY = 0;

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
    enterDelay: 0,
  };

  constructor(...args) {
    super(...args);

    this.entering = false;
    this.leaving = false;
    this.state = {
      isOpen: false,
    };
  }

  open = () => {
    this.setState({isOpen: true});
  };

  close = () => {
    this.setState({isOpen: false});
  };

  handleStateChange = () => {};

  // Adds a delay when mouse hovers on actor (in this case the breadcrumb)
  handleMouseEnterActor = (actions, e) => {
    if (this.leaving) {
      clearTimeout(this.leaving);
    }

    this.entering = setTimeout(() => this.open(), this.props.enterDelay);
  };

  // handles mouseEnter event on actor and menu, should clear the leaving timeout and keep menu open
  handleMouseEnter = (actions, e) => {
    if (this.leaving) {
      clearTimeout(this.leaving);
    }

    this.open();
  };

  // handles mouseLeave event on actor and menu, adds a timeout before updating state to account for
  // mouseLeave into
  handleMouseLeave = (actions, e) => {
    if (this.entering) {
      clearTimeout(this.entering);
    }

    this.leaving = setTimeout(() => this.close(), EXIT_DELAY);
  };

  // Close immediately when actor is clicked clicked
  handleClickActor = (actions, e) => {
    this.close();
  };

  // Close immediately when clicked outside
  handleClose = actions => {
    this.close();
  };

  render() {
    let {hasMenu, route, isLast, name, items, onSelect} = this.props;
    return (
      <DropdownAutoCompleteMenu
        blendCorner={false}
        alignMenu="left"
        onOpen={this.handleMouseEnter}
        onClose={this.close}
        isOpen={this.state.isOpen}
        menuProps={{
          onMouseEnter: this.handleMouseEnter,
          onMouseLeave: this.handleMouseLeave,
        }}
        items={items}
        onSelect={onSelect}
        isStyled
      >
        {({actions, isOpen}) => {
          return (
            <Crumb
              hasMenu={hasMenu}
              onClick={this.handleClickActor.bind(this, actions)}
              onMouseEnter={this.handleMouseEnterActor.bind(this, actions)}
              onMouseLeave={this.handleMouseLeave.bind(this, actions)}
            >
              <span>{name || route.name} </span>
              <Divider isHover={hasMenu && isOpen} isLast={isLast} />
            </Crumb>
          );
        }}
      </DropdownAutoCompleteMenu>
    );
  }
}

export default BreadcrumbDropdown;
