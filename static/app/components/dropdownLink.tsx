import * as React from 'react';
import {css, withTheme} from '@emotion/react';
import classNames from 'classnames';

import DropdownMenu from 'app/components/dropdownMenu';
import {IconChevron} from 'app/icons';
import {Theme} from 'app/utils/theme';

const getRootCss = (theme: Theme) => css`
  .dropdown-menu {
    & > li > a {
      color: ${theme.textColor};

      &:hover,
      &:focus {
        color: inherit;
        background-color: ${theme.focus};
      }
    }

    & .disabled {
      cursor: not-allowed;
      &:hover {
        background: inherit;
        color: inherit;
      }
    }
  }

  .dropdown-submenu:hover > span {
    color: ${theme.textColor};
    background: ${theme.focus};
  }
`;

// .dropdown-actor-title = flexbox to fix vertical alignment on firefox Need
// the extra container because dropdown-menu alignment is off if
// `dropdown-actor` is a flexbox

type Props = Omit<
  Omit<DropdownMenu['props'], 'children'>,
  keyof typeof DropdownMenu.defaultProps
> &
  Partial<typeof DropdownMenu.defaultProps> & {
    theme: Theme;
    children: React.ReactNode;
    title?: React.ReactNode;
    customTitle?: React.ReactNode;
    /**
     * display dropdown caret
     */
    caret?: boolean;
    disabled?: boolean;
    /**
     * Anchors menu to the right
     */
    anchorRight?: boolean;
    anchorMiddle?: boolean;
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

const DropdownLink = withTheme(
  ({
    anchorRight,
    anchorMiddle,
    disabled,
    title,
    customTitle,
    caret,
    children,
    menuClasses,
    className,
    alwaysRenderMenu,
    topLevelClasses,
    theme,
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
          'anchor-middle': anchorMiddle,
          open: isOpen,
        });

        return (
          <span
            css={getRootCss(theme)}
            {...getRootProps({
              className: topLevelCx,
            })}
          >
            <a
              {...getActorProps({
                className: cx,
              })}
            >
              {customTitle || (
                <div className="dropdown-actor-title">
                  {title}
                  {caret && <IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />}
                </div>
              )}
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
  )
);

DropdownLink.defaultProps = {
  alwaysRenderMenu: true,
  disabled: false,
  anchorRight: false,
  caret: true,
};

DropdownLink.displayName = 'DropdownLink';

export default DropdownLink;
