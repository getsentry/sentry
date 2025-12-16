import styled from '@emotion/styled';

const StyledDiv = styled('div')`
  background: ${p => p.theme.colors.gray100};
  color: ${p => p.theme.colors.gray800};
`;

function Component({theme}) {
  const backgroundColor = theme.colors.gray200;
  return <div style={{color: theme.colors.gray500}}>Hello</div>;
}
