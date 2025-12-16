import styled from '@emotion/styled';

// Template literals in styled components
const StyledDiv = styled('div')`
  background: ${p => p.theme.gray100};
  border: 1px solid ${props => props.theme.gray200};
  color: ${({theme}) => theme.gray500};
`;

// Template literals in regular code
const cssString = `color: ${theme.blue400}; background: ${theme.surface100};`;

// Arrow functions with different param names
const getColor = (p) => p.theme.red400;
const getBg = (props) => props.theme.green300;
