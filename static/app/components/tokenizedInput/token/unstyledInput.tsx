import styled from '@emotion/styled';

import {Input} from '@sentry/scraps/input';

export const UnstyledInput = styled(Input)`
  background: transparent;
  border: none;
  box-shadow: none;
  flex-grow: 1;
  padding: 0;
  height: auto;
  min-height: auto;
  resize: none;
  min-width: 1px;
  border-radius: 0;

  &:focus {
    outline: none;
    border: none;
    box-shadow: none;
  }
`;
