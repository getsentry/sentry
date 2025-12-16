import styled from '@emotion/styled';

export const FlexContainer = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const InternalFlex = styled('div')`
  display: flex;
  gap: 8px;
`;

function MyComponent() {
  return (
    <div>
      <FlexContainer>Exported</FlexContainer>
      <InternalFlex>Internal</InternalFlex>
    </div>
  );
}
