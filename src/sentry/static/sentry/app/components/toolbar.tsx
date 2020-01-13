import styled from '@emotion/styled';

const Toolbar = styled('div')`
  background: ${p => p.theme.whiteDark};
  border: 1px solid ${p => p.theme.borderLight};
  border-bottom: none;
  border-radius: 3px 3px 0 0;
  box-shadow: 0 1px 0 ${p => p.theme.borderLight};
  margin: 0;
`;

export default Toolbar;
