import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {OnboardingWelcomeProductId} from 'sentry/views/onboarding/types';

interface ProductCardProps {
  description: string;
  icon: React.ReactNode;
  id: OnboardingWelcomeProductId;
  title: string;
  badge?: ReactNode;
  extra?: ReactNode;
  footer?: ReactNode;
  span?: number;
}

export function NewWelcomeProductCard({
  icon,
  title,
  description,
  badge,
  footer,
  extra,
  id,
}: ProductCardProps) {
  const consideredSeerCard = id === OnboardingWelcomeProductId.SEER;

  return (
    <CardContainer
      border="muted"
      radius="lg"
      padding="xl"
      background={consideredSeerCard ? 'secondary' : 'primary'}
      overflow={consideredSeerCard ? 'hidden' : undefined}
      position={consideredSeerCard ? 'relative' : undefined}
      $seer={consideredSeerCard}
    >
      <Grid
        columns="min-content 1fr"
        rows="min-content min-content"
        gap="xs lg"
        align="center"
        areas={`
          "cell1 cell2"
          ". cell4"
        `}
      >
        <Flex area="cell1" align="center">
          {icon}
        </Flex>
        <Flex area="cell2" gap="md">
          <Container>
            <Text bold size="lg" density="comfortable">
              {title}
            </Text>
          </Container>
          {badge}
        </Flex>
        <Stack area="cell4" gap="xl">
          <Container>
            <Text variant="muted" size="md" density="comfortable">
              {description}
            </Text>
          </Container>
          {footer}
        </Stack>
      </Grid>

      {extra}
    </CardContainer>
  );
}

const CardContainer = styled(Container)<{$seer?: boolean}>`
  ${p =>
    p.$seer &&
    `
    @media (min-width: ${p.theme.breakpoints.md}) {
      padding-right: 36%;
      grid-column: span 2;
    }
  `}
`;
