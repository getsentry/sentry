import {Flex, type FlexProps} from '@sentry/scraps/layout';

export function OverChartButtonGroup(props: FlexProps) {
  return <Flex justify="between" gap="xs" {...props} />;
}
