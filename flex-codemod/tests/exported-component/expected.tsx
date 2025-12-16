import {Flex} from '@sentry/scraps/layout';
import styled from '@emotion/styled';





function MyComponent() {
  return (
    <div>
      <Flex justify="center" align="center">Exported</Flex>
      <Flex gap="sm">Internal</Flex>
    </div>
  );
}
