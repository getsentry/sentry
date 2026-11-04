import {Stack, type StackProps} from '@sentry/scraps/layout';

export function Container(props: StackProps) {
  return (
    <Stack
      gap="xl"
      justify="start"
      backgroundColor="primary"
      borderColor="primary"
      radius="md"
      padding="lg"
      minWidth={{zero: 'fit-content', '4xl': 'auto'}}
      flex={{zero: 1, '4xl': 'initial'}}
      {...props}
    />
  );
}
