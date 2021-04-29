import React, {MouseEvent} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import DropdownMenu from 'app/components/dropdownMenu';
import {IconEllipsis} from 'app/icons';

const ContextMenu = ({children}) => (
  <DropdownMenu>
    {({isOpen, getRootProps, getActorProps, getMenuProps}) => {
      const topLevelCx = classNames('dropdown', {
        'anchor-right': true,
        open: isOpen,
      });

      return (
        <MoreOptions
          {...getRootProps({
            className: topLevelCx,
          })}
        >
          <DropdownTarget
            {...getActorProps<HTMLDivElement>({
              onClick: (event: MouseEvent) => {
                event.stopPropagation();
                event.preventDefault();
              },
            })}
          >
            <IconEllipsis data-test-id="context-menu" size="md" />
          </DropdownTarget>
          {isOpen && (
            <ul {...getMenuProps({})} className={classNames('dropdown-menu')}>
              {children}
            </ul>
          )}
        </MoreOptions>
      );
    }}
  </DropdownMenu>
);

const MoreOptions = styled('span')`
  display: flex;
  color: ${p => p.theme.textColor};
`;

const DropdownTarget = styled('div')`
  display: flex;
  cursor: pointer;
`;

export default ContextMenu;
