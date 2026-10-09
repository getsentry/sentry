import {Container, Grid} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

export function DetailsContainer({children}: {children: React.ReactNode}) {
  return (
    <Grid columns={{zero: '1fr', xl: '1fr 1fr'}} gap="xl" align="start">
      {children}
    </Grid>
  );
}

export function DetailsHeading({children}: {children: React.ReactNode}) {
  return (
    <Container
      marginTop="2xl"
      marginBottom="xl"
      paddingBottom="xs"
      borderBottom="secondary"
    >
      <Heading as="h6" size="md" variant="muted">
        <Text as="span" variant="inherit" uppercase>
          {children}
        </Text>
      </Heading>
    </Container>
  );
}
