import {MouseEvent} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import Button from 'app/components/button';
import DropdownMenu from 'app/components/dropdownMenu';
import {IconEllipsis} from 'app/icons';
import space from 'app/styles/space';

const DiscoverQueryMenu = ({children}) => (
  <DropdownMenu>
    {({isOpen, getRootProps, getActorProps, getMenuProps}) => {
      const topLevelCx = classNames('dropdown', {
        'anchor-right': true,
        open: isOpen,
      });

      return (
        <span
          {...getRootProps({
            className: topLevelCx,
          })}
        >
          <DropdownTarget
            {...getActorProps({
              onClick: (event: MouseEvent) => {
                event.stopPropagation();
                event.preventDefault();
              },
            })}
          >
            <Button>
              <IconEllipsis data-test-id="context-menu" size="14px" />
            </Button>
          </DropdownTarget>
          {isOpen && (
            <Menu {...getMenuProps({})} className={classNames('dropdown-menu')}>
              {children}
            </Menu>
          )}
        </span>
      );
    }}
  </DropdownMenu>
);

const DropdownTarget = styled('div')`
  display: flex;
  cursor: pointer;
`;

const Menu = styled('ul')`
  margin-top: ${space(2)};
`;

export default DiscoverQueryMenu;
