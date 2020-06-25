import React from 'react';
import styled from '@emotion/styled';

import theme from 'app/utils/theme';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';

export const List = styled('ul')`
  list-style: none;
  padding: 0;
  margin-bottom: ${space(2)};

  li {
    padding-left: 34px;
    position: relative;
    margin-bottom: ${space(0.5)};
  }

  li:before,
  li > span {
    position: absolute;
    left: 0;
  }

  ul& {
    li {
      display: flex;
      align-items: center;
      color: ${theme.gray700};
      &:before {
        content: '';
        width: 6px;
        height: 6px;
        border-radius: 50%;
        margin-right: ${space(2)};
        border: 1px solid ${theme.gray700};
        background-color: transparent;
        left: 6px;
        top: 10px;
      }
    }
  }

  ul& li span {
    top: 4px;
  }

  ol& {
    counter-reset: numberedList;

    li {
      display: flex;
      align-items: center;

      &:before {
        top: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        width: 18px;
        height: 18px;
        font-size: 10px;
        font-weight: 600;
        border: 1px solid ${theme.gray700};
        border-radius: 50%;
        background-color: transparent;
        margin-right: ${space(2)};
        counter-increment: numberedList;
        content: counter(numberedList);
      }
    }
  }

  .icons-wrapper:before {
    content: none;
  }
`;

type ListItemProps = {
  icon?: string | React.ReactNode;
  children?: string | React.ReactNode;
};

const IconWrapper = styled('span')`
  display: flex;
  margin-right: ${space(1)};

  /* Give the wrapper an explicit height so icons are line height with the
   * (common) line height. */
  height: 16px;
  align-items: center;
`;

export const ListItem = styled(({icon, children}: ListItemProps) => (
  <li className={icon && 'icons-wrapper'}>
    {icon && (
      <IconWrapper>
        {typeof icon === 'string' ? <InlineSvg src={icon} /> : icon}
      </IconWrapper>
    )}
    {children}
  </li>
))<ListItemProps>``;
