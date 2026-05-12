import {Flex, type FlexProps} from '@sentry/scraps/layout';

export function ToolRibbon(props: FlexProps) {
  return <Flex wrap="wrap" gap="xl" position="relative" {...props} />;
}
