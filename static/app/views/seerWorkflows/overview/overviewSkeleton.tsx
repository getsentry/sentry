import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {Placeholder} from 'sentry/components/placeholder';

function CardSkeleton() {
  return (
    <Container background="primary" border="primary" radius="md" padding="xl">
      <Stack gap="lg">
        <Placeholder height="1.25rem" width="60%" />
        <Flex gap="md" wrap="wrap">
          <Placeholder height="1rem" width="4rem" />
          <Placeholder height="1rem" width="5rem" />
          <Placeholder height="1rem" width="4rem" />
        </Flex>
      </Stack>
    </Container>
  );
}

export function OverviewSkeleton() {
  return (
    <Stack gap="lg" aria-hidden>
      {Array.from({length: 2}).map((_, section) => (
        <Stack gap="md" key={section}>
          <Placeholder height="1.5rem" width="10rem" />
          {Array.from({length: 2}).map((__, card) => (
            <CardSkeleton key={card} />
          ))}
        </Stack>
      ))}
    </Stack>
  );
}
