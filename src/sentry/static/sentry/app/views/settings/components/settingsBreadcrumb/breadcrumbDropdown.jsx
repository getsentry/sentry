import PropTypes from 'prop-types';
import {Component} from 'react';

import Crumb from 'app/views/settings/components/settingsBreadcrumb/crumb';
import DropdownAutoCompleteMenu from 'app/components/dropdownAutoComplete/menu';
import Divider from 'app/views/settings/components/settingsBreadcrumb/divider';

const EXIT_DELAY = 0;

class BreadcrumbDropdown extends Component {
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
  handleMouseEnterActor = () => {
    if (this.leaving) {
      clearTimeout(this.leaving);
    }

    this.entering = setTimeout(() => this.open(), this.props.enterDelay);
  };

  // handles mouseEnter event on actor and menu, should clear the leaving timeout and keep menu open
  handleMouseEnter = () => {
    if (this.leaving) {
      clearTimeout(this.leaving);
    }

    this.open();
  };

  // handles mouseLeave event on actor and menu, adds a timeout before updating state to account for
  // mouseLeave into
  handleMouseLeave = () => {
    if (this.entering) {
      clearTimeout(this.entering);
    }

    this.leaving = setTimeout(() => this.close(), EXIT_DELAY);
  };

  // Close immediately when actor is clicked clicked
  handleClickActor = () => {
    this.close();
  };

  // Close immediately when clicked outside
  handleClose = () => {
    this.close();
  };

  render() {
    const {hasMenu, route, isLast, name, items, onSelect} = this.props;
    return (
      <DropdownAutoCompleteMenu
        blendCorner={false}
        onOpen={this.handleMouseEnter}
        onClose={this.close}
        isOpen={this.state.isOpen}
        menuProps={{
          onMouseEnter: this.handleMouseEnter,
          onMouseLeave: this.handleMouseLeave,
        }}
        items={items}
        onSelect={onSelect}
        virtualizedHeight={41}
      >
        {({getActorProps, actions, isOpen}) => (
          <Crumb
            {...getActorProps({
              hasMenu,
              onClick: this.handleClickActor.bind(this, actions),
              onMouseEnter: this.handleMouseEnterActor.bind(this, actions),
              onMouseLeave: this.handleMouseLeave.bind(this, actions),
            })}
          >
            <span>{name || route.name} </span>
            <Divider isHover={hasMenu && isOpen} isLast={isLast} />
          </Crumb>
        )}
      </DropdownAutoCompleteMenu>
    );
  }
}

export default BreadcrumbDropdown;
