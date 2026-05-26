import {Flex, type FlexProps} from '@sentry/scraps/layout';

export function OverChartButtonGroup(props: FlexProps) {
  return (
    <Flex
      justify={props.justify ? props.justify : {sm: 'end', md: 'between'}}
      gap="xs"
      {...props}
    />
  );
}
