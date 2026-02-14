import {Flex, type FlexProps} from '@sentry/scraps/layout';

export function WidgetToolbar(props: FlexProps<'div'>) {
  return <Flex gap="xs" {...props} />;
}
