import {Flex, type FlexProps} from '@sentry/scraps/layout';

export function OverChartButtonGroup(props: FlexProps<'div'>) {
  return <Flex justify="end" marginBottom="md" gap="xs" {...props} />;
}
