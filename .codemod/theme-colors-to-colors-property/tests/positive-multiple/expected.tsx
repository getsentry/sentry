import styled from '@emotion/styled';

const Component = styled('div')`
  background: ${p => p.theme.colors.gray100};
  border-color: ${p => p.theme.colors.gray200};
  color: ${p => p.theme.colors.gray800};
`;

const styles = {
  primary: theme.colors.blue500,
  danger: theme.colors.red500,
  success: theme.colors.green500,
};
