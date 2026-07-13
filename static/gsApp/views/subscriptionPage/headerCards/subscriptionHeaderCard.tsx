import React, {Fragment} from 'react';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

interface SubscriptionHeaderCardProps {
  sections: React.ReactNode[];
  isHighlighted?: boolean;
  isMainCard?: boolean;
  subtitle?: React.ReactNode;
  title?: React.ReactNode;
}

export function SubscriptionHeaderCard({
  title,
  sections,
  isMainCard = false,
  subtitle,
  isHighlighted = false,
}: SubscriptionHeaderCardProps) {
  return (
    <Stack
      padding="xl"
      background={isMainCard ? 'secondary' : 'primary'}
      border={isHighlighted ? 'accent' : 'primary'}
      radius="md"
      gap="lg"
    >
      {title && (
        <Flex align="center" gap="sm">
          <Heading as="h2" size="lg">
            {title}
          </Heading>
        </Flex>
      )}

      {subtitle && <Text variant="muted">{subtitle}</Text>}
      <Stack gap="lg" align="start" height="100%">
        {sections.map((section, index) => {
          return <Fragment key={index}>{section}</Fragment>;
        })}
      </Stack>
    </Stack>
  );
}
