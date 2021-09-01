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
            <Button size="small">
              <IconEllipsis data-test-id="context-menu" size="md" />
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
  margin-right: ${space(0.25)};
`;

export default DiscoverQueryMenu;
