import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import theme from 'app/utils/theme';
import space from 'app/styles/space';

const listStyle = css`
  list-style: none;
  padding: 0;
  margin-bottom: ${space(2)};
`;

export const List = styled('ul')`
  ${listStyle};
`;

export const OrderedList = styled('ol')`
  ${listStyle};
  counter-reset: numberedList;
`;

type ListItemProps = {
  icon?: React.ReactNode;
  children?: string | React.ReactNode;
  className?: string;
};

const IconWrapper = styled('span')`
  display: flex;
  margin-right: ${space(1)};

  /* Give the wrapper an explicit height so icons are line height with the
   * (common) line height. */
  height: 16px;
  align-items: center;
`;

export const ListItem = styled(({icon, className, children}: ListItemProps) => (
  <li className={className}>
    {icon && <IconWrapper>{icon}</IconWrapper>}
    {children}
  </li>
))<ListItemProps>`
  display: flex;
  align-items: center;
  position: relative;
  padding-left: 34px;
  margin-bottom: ${space(0.5)};

  &:before,
  & > ${IconWrapper} {
    position: absolute;
    left: 0;
  }

  ul & {
    color: ${theme.gray700};
    &:before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      margin-right: ${space(2)};
      border: 1px solid ${theme.gray700};
      background-color: transparent;
      left: 5px;
      top: 10px;
    }

    ${p =>
      p.icon &&
      `
      & > ${IconWrapper} {
        top: ${space(0.5)};
      }

      &:before {
        content: none;
      }
    `}
  }

  ol & {
    &:before {
      counter-increment: numberedList;
      content: counter(numberedList);
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
    }
  }
`;
