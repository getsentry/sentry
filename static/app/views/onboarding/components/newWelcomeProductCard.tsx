import type {ReactNode} from 'react';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {OnboardingWelcomeProductId} from 'sentry/views/onboarding/types';

export interface ProductOption {
  description: string;
  icon: ReactNode;
  id: OnboardingWelcomeProductId;
  title: string;
  badge?: ReactNode;
}

interface NewWelcomeProductCardProps {
  product: ProductOption;
}

export function NewWelcomeProductCard({product}: NewWelcomeProductCardProps) {
  const {icon, title, description, badge} = product;

  return (
    <Grid
      columns="min-content 1fr"
      rows="min-content min-content"
      gap="md"
      align="center"
      areas={`
          "cell1 cell2"
          "cell4 cell4"
        `}
    >
      <Flex area="cell1" align="center">
        {icon}
      </Flex>
      <Flex area="cell2" gap="md">
        <Container>
          <Text bold size="md" density="comfortable">
            {title}
          </Text>
        </Container>
        {badge}
      </Flex>
      <Stack area="cell4" gap="xl">
        <Container>
          <Text
            as="p"
            variant="secondary"
            size="md"
            density="comfortable"
            textWrap="pretty"
          >
            {description}
          </Text>
        </Container>
      </Stack>
    </Grid>
  );
}
