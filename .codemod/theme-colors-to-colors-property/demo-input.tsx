import styled from '@emotion/styled';

// Example 1: Styled components with nested theme access
const StyledDiv = styled('div')`
  background: ${p => p.theme.gray100};
  color: ${p => p.theme.gray500};
  border: 1px solid ${props => props.theme.gray200};
`;

// Example 2: Direct theme access
function Component({theme}) {
  const backgroundColor = theme.gray200;
  const textColor = theme.gray800;

  return (
    <div style={{
      color: theme.gray800,
      backgroundColor: theme.surface500,
      borderColor: theme.blue400
    }}>
      Content
    </div>
  );
}

// Example 3: String literals (should NOT be transformed)
const colorName = "gray100";
const config = {
  key: "blue500",
  value: theme.blue500  // This SHOULD be transformed
};

// Example 4: All color types
const colors = {
  gray: theme.gray300,
  surface: theme.surface100,
  blue: theme.blue400,
  pink: theme.pink500,
  red: theme.red400,
  yellow: theme.yellow300,
  green: theme.green500,
  black: theme.black,
  white: theme.white
};
