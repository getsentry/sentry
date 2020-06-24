import React from 'react';
import styled from '@emotion/styled';

import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';

export const List = styled('ul')`
  background-color: red;
`;

type ListItemProps = {
  icon?: string | React.ReactNode;
  children?: string | React.ReactNode;
};

const listItemStyles = styled('li')`
  background: red;
`;

const IconWrapper = styled('span')`
  display: flex;
  margin-right: ${space(1)};

  /* Give the wrapper an explicit height so icons are line height with the
   * (common) line height. */
  height: 22px;
  align-items: center;
`;

export const ListItem = styled(({icon, children}: ListItemProps) => (
  <li>
    {icon && (
      <IconWrapper>
        {typeof icon === 'string' ? <InlineSvg src={icon} /> : icon}
      </IconWrapper>
    )}
    {children}
  </li>
))<ListItemProps>`
  ${listItemStyles}
`;
