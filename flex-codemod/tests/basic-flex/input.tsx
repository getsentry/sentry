import styled from '@emotion/styled';

const FlexContainer = styled('div')`
  display: flex;
  justify-content: center;
`;

function MyComponent() {
  return (
    <FlexContainer>
      <span>Content</span>
    </FlexContainer>
  );
}

export default MyComponent;
