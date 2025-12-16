import styled from '@emotion/styled';

const VerticalStack = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

function Component() {
  return (
    <VerticalStack>
      <div>Item 1</div>
      <div>Item 2</div>
    </VerticalStack>
  );
}
