import styled from '@emotion/styled';

const Wrapper = styled('div')`
  max-width: 769px;
  margin-left: auto;
  margin-right: auto;
  padding: ${p => p.theme.space['3xl']};
  background-color: ${p => p.theme.tokens.background.primary};
  z-index: 100;
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.05);
  border-radius: 10px;
  width: 100%;
  color: ${p => p.theme.tokens.content.secondary};
  mark {
    border-radius: 8px;
    padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.xs}
      ${p => p.theme.space['2xs']} ${p => p.theme.space.xs};
    background: ${p => p.theme.colors.gray100};
    margin-right: ${p => p.theme.space.xs};
  }
  h2 {
    color: ${p => p.theme.colors.gray800};
  }
  p {
    margin: ${p => p.theme.space.md} ${p => p.theme.space.xs};
  }
  svg {
    margin: ${p => p.theme.space.xs};
  }
  .encrypt-help {
    color: ${p => p.theme.colors.gray800};
    padding-bottom: ${p => p.theme.space.md};
  }
  .encrypt-note {
    color: ${p => p.theme.tokens.content.secondary};
    padding-top: ${p => p.theme.space.md};
  }
`;

export default Wrapper;
