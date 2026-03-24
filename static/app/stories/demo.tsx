import {Flex, type FlexProps} from '@sentry/scraps/layout';

export function Demo(props: FlexProps<'div'>) {
  return (
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
      marginTop="md"
      // Markdown injects a line break after the component, which we need to compensate for
      // in order for the two to appear as one.
      style={{marginBottom: '-1lh'}}
      {...props}
    />
  );
}
