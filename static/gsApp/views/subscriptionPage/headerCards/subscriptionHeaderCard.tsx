import React, {Fragment} from 'react';

import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';

interface SubscriptionHeaderCardProps {
  sections: React.ReactNode[];
  isFocused?: boolean;
  isMainCard?: boolean;
  subtitle?: React.ReactNode;
  title?: React.ReactNode;
}

function SubscriptionHeaderCard({
  title,
  sections,
  isMainCard = false,
  subtitle,
  isFocused = false,
}: SubscriptionHeaderCardProps) {
  return (
    <Flex
      direction="column"
      padding="xl"
      background={isMainCard ? 'secondary' : 'primary'}
      border={isFocused ? 'accent' : 'primary'}
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
      <Flex direction="column" gap="lg" align="start" height="100%">
        {sections.map((section, index) => {
          return <Fragment key={index}>{section}</Fragment>;
        })}
      </Flex>
    </Flex>
  );
}

export default SubscriptionHeaderCard;
