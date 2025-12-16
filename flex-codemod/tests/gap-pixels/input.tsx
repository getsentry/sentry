import styled from '@emotion/styled';

const FlexWith16px = styled('div')`
  display: flex;
  gap: 16px;
`;

const FlexWith8px = styled('div')`
  display: flex;
  gap: 8px;
`;

function Component() {
  return (
    <>
      <FlexWith16px>Content</FlexWith16px>
      <FlexWith8px>Content</FlexWith8px>
    </>
  );
}
