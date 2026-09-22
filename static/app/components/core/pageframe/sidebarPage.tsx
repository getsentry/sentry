import {
  Container,
  Grid,
  type ContainerProps,
  type GridProps,
} from '@sentry/scraps/layout';

type SidebarPageRootProps = Omit<GridProps, 'columns' | 'containerType'>;
type SidebarPageMainProps = Omit<ContainerProps<'main'>, 'as' | 'column'>;
type SidebarPageAsideProps = Omit<ContainerProps<'aside'>, 'as' | 'column'>;

function SidebarPageRoot(props: SidebarPageRootProps) {
  return (
    <Grid
      containerType="inline-size"
      flexGrow={1}
      columns={{zero: 'minmax(0, 1fr)', '4xl': 'minmax(100px, auto) 325px'}}
      alignContent="start"
      gap="2xl"
      background="primary"
      padding={{'screen:sm': 'lg', 'screen:md': 'lg xl'}}
      {...props}
    />
  );
}

function Main(props: SidebarPageMainProps) {
  return (
    <Container
      as="main"
      column={{zero: '1 / -1', '4xl': '1 / 2'}}
      minWidth={0}
      width="100%"
      {...props}
    />
  );
}

function Aside(props: SidebarPageAsideProps) {
  return <Container as="aside" column={{zero: '1 / -1', '4xl': '2 / 3'}} {...props} />;
}

export const SidebarPage = Object.assign(SidebarPageRoot, {Main, Aside});
