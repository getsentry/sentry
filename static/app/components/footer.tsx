import styled from '@emotion/styled';

type Props = {
  className?: string;
};

function BaseFooter(_props: Props) {
  return null;
}

export const Footer = styled(BaseFooter)`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  align-content: center;
  padding: ${p => p.theme.space.xl} ${p => p.theme.space['3xl']};
  margin-top: auto; /* pushes footer to the bottom of the page when loading */

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    padding: ${p => p.theme.space.xl};
  }

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: none;
  }
`;
