import styled from '@emotion/styled';

const StyledDiv = styled('div')`
  background: ${p => p.theme.gray100};
  color: ${p => p.theme.gray500};
`;

function Component({theme}) {
  const backgroundColor = theme.gray200;
  return <div style={{color: theme.gray400}}>Hello</div>;
}
