import styled from '@emotion/styled';

const Component = styled('div')`
  background: ${p => p.theme.gray100};
  border-color: ${p => p.theme.gray200};
  color: ${p => p.theme.gray500};
`;

const styles = {
  primary: theme.blue400,
  danger: theme.red400,
  success: theme.green400,
};
