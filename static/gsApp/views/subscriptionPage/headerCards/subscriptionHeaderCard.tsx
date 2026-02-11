import React, {Fragment} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

interface SubscriptionHeaderCardProps {
  sections: React.ReactNode[];
  isHighlighted?: boolean;
  isMainCard?: boolean;
  subtitle?: React.ReactNode;
  title?: React.ReactNode;
}

function SubscriptionHeaderCard({
  title,
  sections,
  isMainCard = false,
  subtitle,
  isHighlighted = false,
}: SubscriptionHeaderCardProps) {
  return (
    <Flex
      direction="column"
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
      <Flex direction="column" gap="lg" align="start" height="100%">
        {sections.map((section, index) => {
          return <Fragment key={index}>{section}</Fragment>;
        })}
      </Flex>
    </Flex>
  );
}

export default SubscriptionHeaderCard;
