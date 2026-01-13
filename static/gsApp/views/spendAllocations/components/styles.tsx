import {useTheme} from '@emotion/react';

import {Container, Flex, Grid, type FlexProps} from '@sentry/scraps/layout';

export function Card({
  children,
  ...props
}: {children: React.ReactNode} & React.ComponentProps<'div'>) {
  const theme = useTheme();
  return (
    <Container
      border="primary"
      radius="md"
      background="primary"
      style={{boxShadow: theme.tokens.shadow.elevationMedium}}
      margin="xl 0"
      padding="xl"
      {...props}
    >
      {children}
    </Container>
  );
}

export function HalvedGrid({
  children,
  ...gridProps
}: {children: React.ReactNode} & React.ComponentProps<typeof Grid>) {
  return (
    <Grid columns="repeat(2, 1fr)" gap="3xl" align="center" {...gridProps}>
      {children}
    </Grid>
  );
}

export function HalvedWithDivider({
  children,
  ...gridProps
}: {children: React.ReactNode} & React.ComponentProps<typeof Grid>) {
  return (
    <Grid columns="2fr 1fr 2fr" margin="md 0" align="center" {...gridProps}>
      {children}
    </Grid>
  );
}

export function Divider() {
  return <Container borderRight="primary" margin="0 md" height="20px" />;
}

export function Centered(props: FlexProps<'div'>) {
  return <Flex justify="center" align="center" {...props} />;
}
