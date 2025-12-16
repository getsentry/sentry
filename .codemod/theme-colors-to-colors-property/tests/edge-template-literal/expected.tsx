import styled from '@emotion/styled';

// Template literals in styled components
const StyledDiv = styled('div')`
  background: ${p => p.theme.colors.gray100};
  border: 1px solid ${props => props.theme.colors.gray200};
  color: ${({theme}) => theme.colors.gray800};
`;

// Template literals in regular code
const cssString = `color: ${theme.colors.blue500}; background: ${theme.colors.surface200};`;

// Arrow functions with different param names
const getColor = p => p.theme.colors.red500;
const getBg = props => props.theme.colors.green400;
