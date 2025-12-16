import {Flex} from '@sentry/scraps/layout';
import {Stack} from '@sentry/scraps/layout';
import styled from '@emotion/styled';
import {space} from 'sentry/styles/space';







export function MyComponent() {
  return (
    <Flex justify="space-between" align="center" gap="lg">
      <Stack as="span" direction="column" gap="md">
        <div>Item 1</div>
        <div>Item 2</div>
      </Stack>
      <Flex>Content</Flex>
    </Flex>
  );
}
