import styled from '@emotion/styled';

const DetailsContainer = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.xl};
  grid-template-columns: 1fr 1fr;
  align-items: start;

  h6 {
    margin-top: ${p => p.theme.space['2xl']};
    margin-bottom: ${p => p.theme.space.xl};
    padding-bottom: ${p => p.theme.space.xs};
    text-transform: uppercase;
    font-size: ${p => p.theme.font.size.md};
    color: ${p => p.theme.tokens.content.secondary};
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

export default DetailsContainer;
