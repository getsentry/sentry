import styled from '@emotion/styled';

export function Divider() {
  return <Wrapper>{'|'}</Wrapper>;
}

const Wrapper = styled('div')`
  color: ${p => p.theme.colors.gray200};
`;
