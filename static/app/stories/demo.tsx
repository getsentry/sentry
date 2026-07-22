import {Container, Flex, type FlexProps} from '@sentry/scraps/layout';

interface DemoProps extends FlexProps {
  resizable?: boolean;
}

export function Demo({resizable, ...props}: DemoProps) {
  return (
    <Container
      containerType="inline-size"
      style={{
        marginBottom: '-1lh',
        // ponytail: native CSS resize, no JS needed
        resize: resizable ? 'inline' : undefined,
        overflow: resizable ? 'hidden' : undefined,
      }}
      marginTop="md"
    >
      <Flex
        data-test-id="storybook-demo"
        width="100%"
        align="center"
        justify="center"
        gap="md"
        padding="3xl xl"
        background="secondary"
        borderTop="primary"
        borderLeft="primary"
        borderRight="primary"
        radius="md md 0 0"
        minHeight="160px"
        overflow="auto"
        maxHeight="512px"
        {...props}
      />
    </Container>
  );
}
