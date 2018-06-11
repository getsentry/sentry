import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import styled from 'react-emotion';

import Button, {ButtonLabel} from 'app/components/button';
import DropdownMenu from 'app/components/dropdownMenu';
import ButtonGroup from 'app/components/buttonGroup';

const StyledDropdown = styled('span')`
  ${ButtonGroup} & {
    margin-left: -1px;

    &.open > .dropdown-menu {
      left: -4px;
    }
  }
`;

// Use as selector
const StyledDropdownToggle = styled(Button)`
  ${ButtonGroup} ${StyledDropdown}:last-child:not(:first-child) & {
    border-bottom-left-radius: 0;
    border-top-left-radius: 0;
  }

  ${ButtonGroup} & {
    ${ButtonLabel} {
      padding-left: 8px;
      padding-right: 8px;
    }
  }
`;

class DropdownLink extends React.Component {
  static propTypes = {
    ...DropdownMenu.propTypes,

    title: PropTypes.node,
    /** display dropdown caret */
    caret: PropTypes.bool,
    disabled: PropTypes.bool,

    /** anchors menu to the right */
    anchorRight: PropTypes.bool,

    /**
     * Always render children of dropdown menu, this is included to support
     * menu items that open a confirm modal. Otherwise when dropdown menu hides,
     * the modal also gets unmounted
     */
    alwaysRenderMenu: PropTypes.bool,

    topLevelClasses: PropTypes.string,
    menuClasses: PropTypes.string,
  };

  static defaultProps = {
    alwaysRenderMenu: true,
    disabled: false,
    anchorRight: false,
    caret: true,
  };

  constructor(...args) {
    super(...args);
  }

  render() {
    let {
      anchorRight,
      disabled,
      title,
      caret,
      children,
      menuClasses,
      className,
      alwaysRenderMenu,
      topLevelClasses,
      isButton,
      ...otherProps
    } = this.props;

    // Default anchor = left
    let isRight = anchorRight;

    let DropdownToggle = isButton ? StyledDropdownToggle : 'a';

    // .dropdown-actor-title = flexbox to fix vertical alignment on firefox
    // Need the extra container because dropdown-menu alignment is off if `dropdown-actor` is a flexbox
    return (
      <DropdownMenu alwaysRenderMenu={alwaysRenderMenu} {...otherProps}>
        {({isOpen, getRootProps, getActorProps, getMenuProps}) => {
          let shouldRenderMenu = alwaysRenderMenu || isOpen;
          let cx = classNames('dropdown-actor', className, {
            'dropdown-menu-right': isRight,
            'dropdown-toggle': true,
            hover: isOpen,
            disabled,
          });
          let topLevelCx = classNames('dropdown', topLevelClasses, {
            'pull-right': isRight,
            'anchor-right': isRight,
            open: isOpen,
          });

          return (
            <StyledDropdown
              {...getRootProps({
                className: topLevelCx,
              })}
            >
              <DropdownToggle
                {...getActorProps({
                  className: cx,
                })}
              >
                <div className="dropdown-actor-title">
                  <span>{title}</span>
                  {caret && <i className="icon-arrow-down" />}
                </div>
              </DropdownToggle>

              {shouldRenderMenu && (
                <ul
                  {...getMenuProps({
                    className: classNames(menuClasses, 'dropdown-menu'),
                  })}
                >
                  {children}
                </ul>
              )}
            </StyledDropdown>
          );
        }}
      </DropdownMenu>
    );
  }
}

export default DropdownLink;
export {StyledDropdownToggle};
