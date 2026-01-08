import styled from '@emotion/styled';

export const AskSeerPane = styled('div')`
  grid-area: seer;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0;
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  background-color: ${p => p.theme.colors.blue100};
  width: 100%;
`;

export const AskSeerListItem = styled('div')<{
  cursor?: 'pointer' | 'auto';
  justifyContent?: 'flex-start' | 'space-between';
}>`
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  background: transparent;
  border-radius: 0;
  background-color: none;
  box-shadow: none;
  color: ${p => p.theme.colors.blue500};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  text-align: left;
  justify-content: ${p => p.justifyContent ?? 'flex-start'};
  gap: ${p => p.theme.space.md};
  list-style: none;
  margin: 0;

  &:hover,
  &:focus {
    cursor: ${p => (p.cursor ? p.cursor : 'pointer')};
  }

  &[aria-selected='true'] {
    background: ${p => p.theme.colors.blue100};
    color: ${p => p.theme.colors.blue500};
  }
`;

export const AskSeerLabel = styled('span')<{
  fontWeight?: 'normal' | 'bold';
  width?: 'auto';
}>`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${p => p.theme.colors.blue500};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.fontWeight ?? p.theme.fontWeight.bold};
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  width: ${p => p.width};
`;
