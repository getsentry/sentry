import {Flex} from '@sentry/scraps/layout';
import styled from '@emotion/styled';

// This component is exported and should NOT be transformed
export const ExportedFlex = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
`;

// This component is internal and SHOULD be transformed


function MyComponent() {
  return (
    <div>
      <ExportedFlex>Exported (not transformed)</ExportedFlex>
      <Flex gap="sm">Internal (transformed)</Flex>
    </div>
  );
}
