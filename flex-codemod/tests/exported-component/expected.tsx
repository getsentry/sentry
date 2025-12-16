import {Flex} from '@sentry/scraps/layout';

export function ExportedFlex({children}: {children?: React.ReactNode}) {
  return (
    <Flex justify="center" align="center">
      {children}
    </Flex>
  );
}

function MyComponent() {
  return (
    <div>
      <ExportedFlex>Exported content</ExportedFlex>
      <Flex gap="sm">Internal content</Flex>
    </div>
  );
}
