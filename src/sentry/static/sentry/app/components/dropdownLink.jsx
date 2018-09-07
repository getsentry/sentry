import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

import DropdownMenu from 'app/components/dropdownMenu';

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
      ...otherProps
    } = this.props;

    // Default anchor = left
    let isRight = anchorRight;

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
            <span
              {...getRootProps({
                className: topLevelCx,
              })}
            >
              <a
                {...getActorProps({
                  className: cx,
                })}
              >
                <div className="dropdown-actor-title">
                  <span>{title}</span>
                  {caret && <i className="icon-arrow-down" />}
                </div>
              </a>

              {shouldRenderMenu && (
                <ul
                  {...getMenuProps({
                    className: classNames(menuClasses, 'dropdown-menu'),
                  })}
                >
                  {children}
                </ul>
              )}
            </span>
          );
        }}
      </DropdownMenu>
    );
  }
}

export default DropdownLink;
