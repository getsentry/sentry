import {Flex, type FlexProps} from '@sentry/scraps/layout';

export function OverChartButtonGroup(props: FlexProps<'div'>) {
  return (
    <Flex
      justify={props.justify ? props.justify : {sm: 'end', md: 'between'}}
      marginBottom="md"
      gap="xs"
      {...props}
    />
  );
}
