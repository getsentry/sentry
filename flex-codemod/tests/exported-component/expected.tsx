import {Flex} from '@sentry/scraps/layout';
import styled from '@emotion/styled';

export const ExportedFlex = ({children}: {children?: React.ReactNode}) => (
  <Flex justify="center" align="center">{children}</Flex>
);



function MyComponent() {
  return (
    <div>
      <ExportedFlex>Exported content</ExportedFlex>
      <Flex gap="sm">Internal content</Flex>
    </div>
  );
}
