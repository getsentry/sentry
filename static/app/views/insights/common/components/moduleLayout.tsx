import {
  Grid,
  Container,
  type GridProps,
  type ContainerProps,
} from '@sentry/scraps/layout';

export function Layout(props: GridProps) {
  return <Grid gap="xl" columns="repeat(12, 1fr)" {...props} />;
}

export function Full(props: ContainerProps) {
  return <Container column="span 12" {...props} />;
}
