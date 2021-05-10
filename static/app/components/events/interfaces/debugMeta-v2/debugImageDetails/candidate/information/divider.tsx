import styled from '@emotion/styled';

function Divider() {
  return <Wrapper>{'|'}</Wrapper>;
}

export default Divider;

const Wrapper = styled('div')`
  color: ${p => p.theme.gray200};
`;
