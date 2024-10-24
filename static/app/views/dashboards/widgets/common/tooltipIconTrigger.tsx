import styled from '@emotion/styled';

export const TooltipIconTrigger = styled('button')`
  background: transparent;
  position: relative;

  width: 24px;
  height: 24px;

  padding: 0;
  margin: 0;
  border: none;

  line-height: 1;
  border-radius: 50%;

  &:focus {
    outline: none;
  }

  &:focus-visible {
    border-style: solid;
    border-width: 1px;
    border-color: ${p => p.theme.button.default.focusBorder};
    box-shadow: ${p => p.theme.button.default.focusBorder} 0 0 0 1px;
  }
`;
