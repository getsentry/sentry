import styled from '@emotion/styled';

export const ExportedFlex = styled('div')`
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
      <ExportedFlex>Exported content</ExportedFlex>
      <InternalFlex>Internal content</InternalFlex>
    </div>
  );
}
