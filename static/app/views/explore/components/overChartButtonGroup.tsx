import {Flex, type FlexProps} from '@sentry/scraps/layout';

export function OverChartButtonGroup(props: FlexProps) {
  return (
    <Flex
      justify={props.justify ? props.justify : {xl: 'end', '3xl': 'between'}}
      gap="xs"
      {...props}
    />
  );
}
