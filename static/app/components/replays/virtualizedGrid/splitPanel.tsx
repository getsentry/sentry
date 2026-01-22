import {Container, type ContainerProps} from '@sentry/scraps/layout';

export function SplitPanel(props: ContainerProps<'div'>) {
  return (
    <Container
      width="100%"
      height="100%"
      overflow="auto"
      position="relative"
      {...props}
    />
  );
}
