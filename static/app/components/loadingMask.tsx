import styled from '@emotion/styled';

export interface LoadingMaskProps extends React.HTMLAttributes<HTMLDivElement> {
  loaded?: boolean;
}

export const LoadingMask = styled('div')<LoadingMaskProps>`
  background-color: ${p =>
    p.loaded ? 'transparent' : p.theme.tokens.background.secondary};
  border-radius: ${p => p.theme.radius.md};
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
`;
