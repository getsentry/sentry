import {css, Theme, useTheme} from '@emotion/react';
import classNames from 'classnames';

import DeprecatedDropdownMenu from 'sentry/components/deprecatedDropdownMenu';
import {IconChevron} from 'sentry/icons';

const getRootCss = (theme: Theme) => css`
  .dropdown-menu {
    & > li > a {
      color: ${theme.textColor};

      &:hover,
      &:focus {
        color: inherit;
        background-color: ${theme.hover};
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
    background: ${theme.hover};
  }
`;

// .dropdown-actor-title = flexbox to fix vertical alignment on firefox Need
// the extra container because dropdown-menu alignment is off if
// `dropdown-actor` is a flexbox

type Props = Omit<
  Omit<DeprecatedDropdownMenu['props'], 'children'>,
  keyof typeof DeprecatedDropdownMenu.defaultProps
> &
  Partial<typeof DeprecatedDropdownMenu.defaultProps> & {
    children: React.ReactNode;
    /**
     * Always render children of dropdown menu, this is included to support menu
     * items that open a confirm modal. Otherwise when dropdown menu hides, the
     * modal also gets unmounted
     */
    alwaysRenderMenu?: boolean;
    anchorMiddle?: boolean;
    /**
     * Anchors menu to the right
     */
    anchorRight?: boolean;
    /**
     * display dropdown caret
     */
    caret?: boolean;
    className?: string;
    customTitle?: React.ReactNode;
    disabled?: boolean;
    menuClasses?: string;
    title?: React.ReactNode;
    topLevelClasses?: string;
  };

function DropdownLink({
  anchorMiddle,
  title,
  customTitle,
  children,
  menuClasses,
  className,
  topLevelClasses,
  anchorRight = false,
  disabled = false,
  caret = true,
  alwaysRenderMenu = true,
  ...otherProps
}: Props) {
  const theme = useTheme();

  return (
    <DeprecatedDropdownMenu alwaysRenderMenu={alwaysRenderMenu} {...otherProps}>
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

        const {onClick: onClickActor, ...actorProps} = getActorProps({
          className: cx,
        });

        return (
          <span
            css={getRootCss(theme)}
            {...getRootProps({
              className: topLevelCx,
            })}
            data-test-id="dropdown-link"
          >
            <a onClick={disabled ? undefined : onClickActor} {...actorProps}>
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
    </DeprecatedDropdownMenu>
  );
}

export default DropdownLink;
