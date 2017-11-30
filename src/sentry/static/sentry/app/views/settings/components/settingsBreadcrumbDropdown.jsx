import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import DropdownMenu from '../../../components/dropdownMenu';
import SettingsBreadcrumbDivider from './settingsBreadcrumbDivider';
import Crumb from './crumb.styled';

const Menu = styled.div`
  font-size: 16px;
  position: absolute;
  opacity: 0;
  visibility: hidden;
  top: 140%;
  width: 200px;
  background: #fff;
  border: 1px solid ${p => p.theme.borderDark};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  transition: 0.1s all ease;
  border-radius: ${p => p.theme.radius};
  overflow: hidden;

  ${p =>
    p.isOpen
      ? `
  opacity: 1;
  visibility: visible;`
      : ''};
`;

class SettingsBreadcrumbDropdown extends React.Component {
  static propTypes = {
    hasMenu: PropTypes.bool,
    route: PropTypes.object,
    isLast: PropTypes.bool,
    enterDelay: PropTypes.number,
  };

  static defaultProps = {
    enterDelay: 200,
  };

  constructor(...args) {
    super(...args);

    this.entering = false;
    this.leaving = false;
    this.state = {isOpen: false};
  }

  // Adds a delay when mouse hovers on actor (in this case the breadcrumb)
  handleMouseEnterActor = () => {
    if (this.leaving) {
      clearTimeout(this.leaving);
    }

    this.entering = setTimeout(
      () => this.setState({isOpen: true}),
      this.props.enterDelay
    );
  };

  // handles mouseEnter event on actor and menu, should clear the leaving timeout and keep menu open
  handleMouseEnter = () => {
    if (this.leaving) {
      clearTimeout(this.leaving);
    }

    this.setState({isOpen: true});
  };

  // handles mouseLeave event on actor and menu, adds a timeout before updating state to account for
  // mouseLeave into
  handleMouseLeave = e => {
    if (this.entering) {
      clearTimeout(this.entering);
    }

    this.leaving = setTimeout(() => this.setState({isOpen: false}), 200);
  };

  // Close immediately when clicked outside
  handleClose = () => {
    this.setState({isOpen: false});
  };

  render() {
    let {children, hasMenu, route, isLast} = this.props;
    return (
      <DropdownMenu isOpen={this.state.isOpen} onClickOutside={this.handleClose}>
        {({isOpen, getRootProps, getActorProps, getMenuProps}) => {
          return (
            <Crumb {...getRootProps({hasMenu})}>
              <div
                {...getActorProps({
                  onMouseEnter: this.handleMouseEnterActor,
                  onMouseLeave: this.handleMouseLeave,
                  style: {display: 'inline'},
                })}
              >
                {route.name}{' '}
              </div>
              <SettingsBreadcrumbDivider isHover={hasMenu && isOpen} isLast={isLast} />
              {hasMenu && (
                <Menu
                  {...getMenuProps({
                    isOpen,
                    isStyled: true,
                    onMouseEnter: this.handleMouseEnter,
                    onMouseLeave: this.handleMouseLeave,
                    className: 'menu',
                  })}
                >
                  {children}
                </Menu>
              )}
            </Crumb>
          );
        }}
      </DropdownMenu>
    );
  }
}

export default SettingsBreadcrumbDropdown;
