import styled from '@emotion/styled';

// This component is exported and should NOT be transformed
export const ExportedFlex = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
`;

// This component is internal and SHOULD be transformed
const InternalFlex = styled('div')`
  display: flex;
  gap: 8px;
`;

function MyComponent() {
  return (
    <div>
      <ExportedFlex>Exported (not transformed)</ExportedFlex>
      <InternalFlex>Internal (transformed)</InternalFlex>
    </div>
  );
}
