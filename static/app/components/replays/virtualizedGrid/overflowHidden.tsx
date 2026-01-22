import {Container, type ContainerProps} from '@sentry/scraps/layout';

export function OverflowHidden(props: ContainerProps<'div'>) {
  return <Container height="100%" overflow="hidden" position="relative" {...props} />;
}
