import styled from '@emotion/styled';

interface FlamegraphToolbarProps {
  children: React.ReactNode;
}

export const FlamegraphToolbar = styled('div')<FlamegraphToolbarProps>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: ${p => p.theme.space(1)};
  gap: ${p => p.theme.space(1)};
`;
