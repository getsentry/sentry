import styled from '@emotion/styled';

const Wrapper = styled('div')`
  max-width: 769px;
  margin-left: auto;
  margin-right: auto;
  padding: ${p => p.theme.space(4)};
  background-color: ${p => p.theme.surface400};
  z-index: 100;
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.05);
  border-radius: 10px;
  width: 100%;
  color: ${p => p.theme.gray300};
  mark {
    border-radius: 8px;
    padding: ${p => p.theme.space(0.25)} ${p => p.theme.space(0.5)}
      ${p => p.theme.space(0.25)} ${p => p.theme.space(0.5)};
    background: ${p => p.theme.gray100};
    margin-right: ${p => p.theme.space(0.5)};
  }
  h2 {
    color: ${p => p.theme.gray500};
  }
  p {
    margin: ${p => p.theme.space(1)} ${p => p.theme.space(0.5)};
  }
  svg {
    margin: ${p => p.theme.space(0.5)};
  }
  .encrypt-help {
    color: ${p => p.theme.gray500};
    padding-bottom: ${p => p.theme.space(1)};
  }
  .encrypt-note {
    color: ${p => p.theme.gray300};
    padding-top: ${p => p.theme.space(1)};
  }
`;

export default Wrapper;
