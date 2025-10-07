import React, {Fragment} from 'react';

import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';

interface SubscriptionHeaderCardProps {
  sections: React.ReactNode[];
  title: React.ReactNode;
  isMainCard?: boolean;
  subtitle?: React.ReactNode;
}

function SubscriptionHeaderCard({
  title,
  sections,
  isMainCard = false,
  subtitle,
}: SubscriptionHeaderCardProps) {
  return (
    <Flex
      direction="column"
      padding="xl"
      background={isMainCard ? 'secondary' : 'primary'}
      border="primary"
      radius="md"
      gap="lg"
    >
      <Flex align="center" gap="sm">
        <Heading as="h2" size="lg">
          {title}
        </Heading>
      </Flex>

      {subtitle && <Text variant="muted">{subtitle}</Text>}
      <Flex direction="column" gap="lg" align="start">
        {sections.map((section, index) => {
          return <Fragment key={index}>{section}</Fragment>;
        })}
      </Flex>
    </Flex>
  );
}

export default SubscriptionHeaderCard;
