import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

import DropdownMenu from 'app/components/dropdownMenu';
import {IconChevron} from 'app/icons';

// .dropdown-actor-title = flexbox to fix vertical alignment on firefox Need
// the extra container because dropdown-menu alignment is off if
// `dropdown-actor` is a flexbox

type Props = Omit<
  Omit<DropdownMenu['props'], 'children'>,
  keyof typeof DropdownMenu.defaultProps
> &
  Partial<typeof DropdownMenu.defaultProps> & {
    title: React.ReactNode;
    children: React.ReactNode;
    /**
     * display dropdown caret
     */
    caret?: boolean;
    disabled?: boolean;
    /**
     * Anchors menu to the right
     */
    anchorRight?: boolean;
    /**
     * Always render children of dropdown menu, this is included to support menu
     * items that open a confirm modal. Otherwise when dropdown menu hides, the
     * modal also gets unmounted
     */
    alwaysRenderMenu?: boolean;
    topLevelClasses?: string;
    menuClasses?: string;
    className?: string;
  };

const DropdownLink = ({
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
}: Props) => (
  <DropdownMenu alwaysRenderMenu={alwaysRenderMenu} {...otherProps}>
    {({isOpen, getRootProps, getActorProps, getMenuProps}) => {
      const shouldRenderMenu = alwaysRenderMenu || isOpen;
      const cx = classNames('dropdown-actor', className, {
        'dropdown-menu-right': anchorRight,
        'dropdown-toggle': true,
        hover: isOpen,
        disabled,
      });
      const topLevelCx = classNames('dropdown', topLevelClasses, {
        'pull-right': anchorRight,
        'anchor-right': anchorRight,
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
              {caret && <IconChevron direction="down" size="xs" />}
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

DropdownLink.defaultProps = {
  alwaysRenderMenu: true,
  disabled: false,
  anchorRight: false,
  caret: true,
};

DropdownLink.propTypes = {
  ...DropdownMenu.propTypes,
  title: PropTypes.node,
  caret: PropTypes.bool,
  disabled: PropTypes.bool,
  anchorRight: PropTypes.bool,
  alwaysRenderMenu: PropTypes.bool,
  topLevelClasses: PropTypes.string,
  menuClasses: PropTypes.string,
};

export default DropdownLink;
