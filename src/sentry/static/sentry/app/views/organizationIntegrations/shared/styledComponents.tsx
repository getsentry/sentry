import React from 'react';
import styled from '@emotion/styled';
import space from 'app/styles/space';

export const TagsContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  padding-top: ${space(3)};
  padding-bottom: ${space(1)};
`;

export const Tag = styled(p => <span {...p} />)`
  transition: border-color 0.15s ease;
  font-size: 14px;
  line-height: 1;
  padding: ${space(1)};
  margin: 0 ${space(1)} ${space(1)} 0;
  border: 1px solid ${p => p.theme.borderDark};
  border-radius: 30px;
  height: 28px;
  box-shadow: inset ${p => p.theme.dropShadowLight};
  cursor: pointer;

  &:focus {
    outline: none;
    border: 1px solid ${p => p.theme.gray1};
  }

  &::placeholder {
    color: ${p => p.theme.gray2};
  }
`;
