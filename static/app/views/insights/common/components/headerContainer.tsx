import {Flex, type FlexProps} from '@sentry/scraps/layout';

export function HeaderContainer(props: FlexProps<'div'>) {
  return <Flex justify="between" wrap="wrap" gap="xl" {...props} />;
}
