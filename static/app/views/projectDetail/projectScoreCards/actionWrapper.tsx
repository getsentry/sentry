import {Container, type ContainerProps} from '@sentry/scraps/layout';

export function ActionWrapper(props: ContainerProps<'div'>) {
  return <Container padding="md 0 0 0" {...props} />;
}
