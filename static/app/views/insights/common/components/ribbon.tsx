import {Flex, type FlexProps} from '@sentry/scraps/layout';

export function ToolRibbon(props: FlexProps<'div'>) {
  return <Flex wrap="wrap" gap="xl" position="relative" {...props} />;
}
