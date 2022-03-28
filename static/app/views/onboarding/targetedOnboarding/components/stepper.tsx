import styled from '@emotion/styled';

export const StepperContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: 8px;
`;

export const StepperIndicator = styled('span')<{active?: boolean; clickable?: boolean}>`
  height: 8px;
  width: 80px;
  background-color: ${p => (p.active ? p.theme.progressBar : p.theme.progressBackground)};
  &:first-child {
    border-top-left-radius: 4px;
    border-bottom-left-radius: 4px;
  }
  &:last-child {
    border-top-right-radius: 4px;
    border-bottom-right-radius: 4px;
  }
  cursor: ${p => (p.clickable ? 'pointer' : 'default')};
`;
